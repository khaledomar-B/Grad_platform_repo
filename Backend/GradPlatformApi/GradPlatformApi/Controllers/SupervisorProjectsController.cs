using GradPlatformApi.Data;
using GradPlatformApi.Model.DTOs;
using GradPlatformApi.Model.Projects;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

using GradPlatformApi.Services;
using GradPlatformApi.Model.Communication;

namespace GradPlatformApi.Controllers
{
    [ApiController]
    [Route("api/supervisor/projects")]
    [Authorize]
    public class SupervisorProjectsController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly NotificationService _notificationService;

        public SupervisorProjectsController(AppDbContext db, NotificationService notificationService)
        {
            _db = db;
            _notificationService = notificationService;
        }

        // ==========================================
        // Get all pending projects (ideas)
        // ==========================================
        [HttpGet("pending")]
        [Authorize(Roles = "Supervisor")]
        public async Task<IActionResult> GetPendingProjects()
        {
            var projects = await _db.Projects
                .Where(p => p.Status == "Pending" && p.SupervisorId == null)
                .OrderByDescending(p => p.CreatedAt)
                .Select(p => new
                {
                    projectId = p.Id,
                    title = p.Title,
                    description = p.Description,
                    createdAt = p.CreatedAt,

                    ownerStudentId = p.OwnerStudentId,
                    ownerName = p.OwnerStudent != null ? p.OwnerStudent.FullName : null,
                    ownerEmail = p.OwnerStudent != null ? p.OwnerStudent.Email : null,
                    ownerUniversityId = p.OwnerStudent != null ? p.OwnerStudent.UniversityId : null
                })
                .ToListAsync();

            return Ok(projects);
        }

        // ==========================================
        // Set Start and End Time for Milestone
        // ==========================================
        [HttpPut("{projectId}/milestones/{milestoneId}/set-dates")]
        [Authorize(Roles = "Supervisor")]
        public async Task<IActionResult> SetMilestoneDates(int projectId, int milestoneId, [FromBody] SetMilestoneDatesDto dto)
        {
            var project = await _db.Projects
                .Include(p => p.Milestones)
                .FirstOrDefaultAsync(p => p.Id == projectId);

            if (project == null)
                return NotFound(new { message = "المشروع غير موجود" });

            var milestone = project.Milestones.FirstOrDefault(m => m.Id == milestoneId);
            if (milestone == null)
                return NotFound(new { message = "المرحلة غير موجودة" });

            var userId = int.Parse(User.FindFirst("id")!.Value);
            if (userId != dto.SupervisorId)
                return Unauthorized(new { message = "ليس لديك صلاحية لتعديل هذه المرحلة" });

            if (dto.EndDate < dto.StartDate)
                return BadRequest(new { message = "تاريخ النهاية يجب أن يكون بعد تاريخ البداية" });

            milestone.StartAt = dto.StartDate;
            milestone.EndAt = dto.EndDate;

            await _db.SaveChangesAsync();

            // ✅ إشعار لكل أعضاء المشروع + المالك بجدولة المرحلة
            try
            {
                var receiverIds = new HashSet<int>();

                if (project.OwnerStudentId.HasValue)
                    receiverIds.Add(project.OwnerStudentId.Value);

                var memberIds = await _db.ProjectMembers
                    .Where(pm => pm.ProjectId == project.Id && pm.Status == "Accepted")
                    .Select(pm => pm.StudentId)
                    .ToListAsync();

                foreach (var id in memberIds)
                    receiverIds.Add(id);

                foreach (var rid in receiverIds)
                {
                    await _notificationService.CreateAsync(
                        receiverId: rid,
                        actorId: userId,
                        type: NotificationType.MilestoneScheduled,
                        title: "تم تحديد موعد مرحلة",
                        message: $"تم تحديد مواعيد مرحلة: {milestone.Name}",
                        data: new
                        {
                            projectId = project.Id,
                            milestoneId = milestone.Id,
                            startAt = milestone.StartAt,
                            endAt = milestone.EndAt,
                            url = $"/progress-phases.html?projectId={project.Id}&milestoneId={milestone.Id}"
                        }
                    );
                }
            }
            catch { }

            return Ok(new { message = "تم تحديث مواعيد المرحلة بنجاح" });
        }

        // ==========================================
        // Review submission (approve / reject)
        // ==========================================
        [HttpPut("submissions/{submissionId}/review")]
        [Authorize(Roles = "Supervisor")]
        public async Task<IActionResult> ReviewSubmission(int submissionId, [FromBody] ReviewSubmissionDto dto)
        {
            var supervisorId = int.Parse(User.FindFirst("id")!.Value);

            var sub = await _db.submissions
                .Include(s => s.Milestone)
                .Include(s => s.Project)
                .FirstOrDefaultAsync(s => s.Id == submissionId);

            if (sub == null)
                return NotFound(new { message = "التسليم غير موجود" });

            var status = (dto.Status ?? "").Trim();
            if (status != "Approved" && status != "Rejected")
                return BadRequest(new { message = "Status لازم يكون Approved أو Rejected" });

            sub.SupervisorComment = dto.SupervisorComment?.Trim();
            sub.Status = status;
            sub.ReviewedAt = DateTime.UtcNow;

            if (status == "Approved")
                sub.Milestone.Status = "Done";
            else
                sub.Milestone.Status = "Open";

            await _db.SaveChangesAsync();

            // ✅ إشعار للطالب صاحب التسليم بنتيجة المراجعة
            try
            {
                var title = status == "Approved" ? "تم قبول تسليمك" : "تم رفض تسليمك";
                var msg = status == "Approved"
                    ? $"تمت الموافقة على تسليمك لمرحلة: {sub.Milestone.Name}"
                    : $"تم رفض تسليمك لمرحلة: {sub.Milestone.Name}";

                await _notificationService.CreateAsync(
                    receiverId: sub.StudentId,
                    actorId: supervisorId,
                    type: NotificationType.ProjectApprovalDecision,
                    title: title,
                    message: msg,
                    data: new
                    {
                        projectId = sub.ProjectId,
                        milestoneId = sub.MilestoneId,
                        submissionId = sub.Id,
                        status = sub.Status,
                        url = $"/progress-phases.html?projectId={sub.ProjectId}&milestoneId={sub.MilestoneId}"
                    }
                );
            }
            catch { }

            return Ok(new { message = "تمت مراجعة التسليم بنجاح" });
        }

        // ==========================================
        // Student requests supervisor
        // ==========================================
        [HttpPost("request-supervisor")]
        [Authorize(Roles = "student")]
        public async Task<IActionResult> RequestSupervisor([FromBody] CreateSupervisorRequestDto dto)
        {
            var studentId = int.Parse(User.FindFirst("id")!.Value);

            var project = await _db.Projects.FirstOrDefaultAsync(p => p.Id == dto.ProjectId);
            if (project == null)
                return NotFound(new { message = "المشروع غير موجود" });

            bool isMember = await _db.ProjectMembers.AnyAsync(pm =>
                pm.ProjectId == dto.ProjectId &&
                pm.StudentId == studentId &&
                pm.Status == "Accepted");

            if (!isMember)
                return Forbid();

            if (project.SupervisorId != null)
                return BadRequest(new { message = "تم تعيين مشرف لهذا المشروع بالفعل" });

            bool exists = await _db.SupervisorRequests.AnyAsync(r =>
                r.ProjectId == dto.ProjectId &&
                r.SupervisorId == dto.SupervisorId &&
                r.Status == "Pending");

            if (exists)
                return BadRequest(new { message = "يوجد طلب معلق لهذا المشروع" });

            bool supOk = await _db.supervisors.AnyAsync(s => s.Id == dto.SupervisorId && s.IsApproved);
            if (!supOk)
                return BadRequest(new { message = "الدكتور غير متاح حالياً" });

            var request = new SupervisorRequest
            {
                ProjectId = dto.ProjectId,
                SupervisorId = dto.SupervisorId,
                Status = "Pending"
            };

            _db.SupervisorRequests.Add(request);
            await _db.SaveChangesAsync();

            return Ok(new { message = "تم إرسال طلب الإشراف بنجاح" });
        }

        [HttpGet("supervisor/requests")]
        [Authorize(Roles = "Supervisor")]
        public async Task<IActionResult> GetMySupervisorRequests()
        {
            var supervisorId = int.Parse(User.FindFirst("id")!.Value);

            var requests = await _db.SupervisorRequests
                .Include(r => r.Project)
                .Where(r =>
                    r.SupervisorId == supervisorId &&
                    r.Status == "Pending" &&
                    r.Project.SupervisorId == null
                )
                .Select(r => new
                {
                    requestId = r.Id,
                    projectId = r.ProjectId,
                    projectTitle = r.Project.Title,
                    createdAt = r.CreatedAt
                })
                .OrderByDescending(r => r.createdAt)
                .ToListAsync();

            return Ok(requests);
        }

        [HttpPost("supervisor/requests/{requestId}/accept")]
        [Authorize(Roles = "Supervisor")]
        public async Task<IActionResult> AcceptSupervisorRequest(int requestId)
        {
            var supervisorId = int.Parse(User.FindFirst("id")!.Value);

            var request = await _db.SupervisorRequests
                .FirstOrDefaultAsync(r => r.Id == requestId);

            if (request == null)
                return NotFound(new { message = "الطلب غير موجود" });

            if (request.SupervisorId != supervisorId)
                return Forbid();

            if (request.Status != "Pending")
                return BadRequest(new { message = "الطلب غير معلق" });

            var project = await _db.Projects
                .Include(p => p.Milestones)
                .FirstOrDefaultAsync(p => p.Id == request.ProjectId);

            if (project == null)
                return NotFound(new { message = "المشروع غير موجود" });

            if (project.SupervisorId != null)
                return BadRequest(new { message = "تم تعيين مشرف لهذا المشروع بالفعل" });

            request.Status = "Accepted";

            project.SupervisorId = supervisorId;
            project.Status = "Active";

            if (project.Milestones != null && project.Milestones.Any())
            {
                foreach (var m in project.Milestones)
                    m.Status = "Locked";

                var first = project.Milestones.OrderBy(m => m.Order).FirstOrDefault();
                if (first != null) first.Status = "Open";
            }

            var otherRequests = await _db.SupervisorRequests
                .Where(r => r.ProjectId == request.ProjectId && r.Id != requestId && r.Status == "Pending")
                .ToListAsync();

            foreach (var r in otherRequests)
                r.Status = "Rejected";

            await _db.SaveChangesAsync();

            // ✅ إشعار للطالب صاحب المشروع بقرار الإشراف (قبول)
            try
            {
                if (project.OwnerStudentId.HasValue)
                {
                    await _notificationService.CreateAsync(
                        receiverId: project.OwnerStudentId.Value,
                        actorId: supervisorId,
                        type: NotificationType.SupervisionRequestDecision,
                        title: "تم قبول طلب الإشراف",
                        message: $"تمت الموافقة على الإشراف على مشروعك: {project.Title}",
                        data: new
                        {
                            projectId = project.Id,
                            status = "Accepted",
                            url = $"/project-dashboard.html?projectId={project.Id}"
                        }
                    );
                }
            }
            catch { }

            return Ok(new { message = "تم قبول طلب الإشراف وتفعيل المشروع" });
        }

        [HttpPost("supervisor/requests/{requestId}/reject")]
        [Authorize(Roles = "Supervisor")]
        public async Task<IActionResult> RejectSupervisorRequest(int requestId)
        {
            var supervisorId = int.Parse(User.FindFirst("id")!.Value);

            var request = await _db.SupervisorRequests
                .FirstOrDefaultAsync(r => r.Id == requestId);

            if (request == null)
                return NotFound(new { message = "الطلب غير موجود" });

            if (request.SupervisorId != supervisorId)
                return Forbid();

            if (request.Status != "Pending")
                return BadRequest(new { message = "الطلب غير معلق" });

            // نجيب المشروع عشان نبعث إشعار للطالب
            var project = await _db.Projects.FirstOrDefaultAsync(p => p.Id == request.ProjectId);

            request.Status = "Rejected";
            await _db.SaveChangesAsync();

            // ✅ إشعار للطالب صاحب المشروع بقرار الإشراف (رفض)
            try
            {
                if (project != null && project.OwnerStudentId.HasValue)
                {
                    await _notificationService.CreateAsync(
                        receiverId: project.OwnerStudentId.Value,
                        actorId: supervisorId,
                        type: NotificationType.SupervisionRequestDecision,
                        title: "تم رفض طلب الإشراف",
                        message: $"تم رفض طلب الإشراف على مشروعك: {project.Title}",
                        data: new
                        {
                            projectId = project.Id,
                            status = "Rejected",
                            url = "/choose-supervisor.html"
                        }
                    );
                }
            }
            catch { }

            return Ok(new { message = "تم رفض الطلب" });
        }

        // ==========================================
        // Get approved supervisors (for student dropdown)
        // ==========================================
        [HttpGet("approved-supervisors")]
        [Authorize(Roles = "student")]
        public async Task<IActionResult> GetApprovedSupervisors()
        {
            var list = await _db.supervisors
                .Where(s => s.IsApproved)
                .OrderBy(s => s.FirstName)
                .Select(s => new
                {
                    id = s.Id,
                    name = s.FirstName + " " + s.LastName,
                    college = s.College,
                    department = s.Department
                })
                .ToListAsync();

            return Ok(list);
        }

        // ==========================================
        // Dashboard statistics (cards)
        // ==========================================
        [HttpGet("dashboard-stats")]
        [Authorize(Roles = "Supervisor")]
        public async Task<IActionResult> GetDashboardStats()
        {
            int supervisorId = int.Parse(User.FindFirst("id")!.Value);

            // مشاريع المشرف النشطة/المعتمدة عنده
            var approved = await _db.Projects.CountAsync(p =>
                p.SupervisorId == supervisorId &&
                p.Status == "Active");

            // ✅ طلبات الإشراف المعلقة عند هذا المشرف فقط
            var pending = await _db.SupervisorRequests
                .Include(r => r.Project)
                .CountAsync(r =>
                    r.SupervisorId == supervisorId &&
                    r.Status == "Pending" &&
                    r.Project.SupervisorId == null
                );

            // إجمالي مشاريع المشرف (اختياري حسب معنى الكرت)
            var total = await _db.Projects.CountAsync(p =>
                p.SupervisorId == supervisorId);

            return Ok(new { approved, pending, total });
        }


        // ==========================================
        // Get active projects for supervisor
        // ==========================================
        [HttpGet("active")]
        [Authorize(Roles = "Supervisor")]
        public async Task<IActionResult> GetActiveProjects()
        {
            int supervisorId = int.Parse(User.FindFirst("id")!.Value);

            var projects = await _db.Projects
                .Where(p =>
                    p.SupervisorId == supervisorId &&
                    p.Status == "Active")
                .Select(p => new
                {
                    projectId = p.Id,
                    title = p.Title,
                    createdAt = p.CreatedAt
                })
                .OrderByDescending(p => p.createdAt)
                .ToListAsync();

            return Ok(projects);
        }

        // ==========================================
        // Broadcast Weekly Report to all active projects of this supervisor
        // ==========================================
        [HttpPost("weekly-reports/broadcast")]
        [Authorize(Roles = "Supervisor")]
        public async Task<IActionResult> BroadcastWeeklyReport([FromBody] WeeklyReportDto dto)
        {
            int supervisorId = int.Parse(User.FindFirst("id")!.Value);

            // اختياري: تحقق بسيط
            if (dto.WeekNumber <= 0 || string.IsNullOrWhiteSpace(dto.Content))
                return BadRequest(new { message = "رقم الأسبوع ومحتوى التقرير مطلوبين" });

            // 1) هات كل مشاريع الدكتور النشطة
            var projectIds = await _db.Projects
                .Where(p => p.SupervisorId == supervisorId && p.Status == "Active")
                .Select(p => p.Id)
                .ToListAsync();

            if (projectIds.Count == 0)
                return BadRequest(new { message = "لا يوجد مشاريع نشطة لهذا المشرف" });

            // 2) أضف تقرير لكل مشروع
            var now = DateTime.UtcNow;
            var reports = projectIds.Select(pid => new WeeklyReport
            {
                ProjectId = pid,
                SupervisorId = supervisorId,
                WeekNumber = dto.WeekNumber,
                Title = dto.Title ?? "",
                Content = dto.Content ?? "",
                CreatedAt = now
            }).ToList();

            _db.WeeklyReports.AddRange(reports);
            await _db.SaveChangesAsync();

            return Ok(new
            {
                message = "تم نشر التقرير على جميع المشاريع النشطة",
                projectsCount = projectIds.Count
            });
        }


        [HttpGet("{projectId}/weekly-reports")]
        [Authorize(Roles = "Supervisor")]
        public async Task<IActionResult> GetWeeklyReports(int projectId)
        {
            int supervisorId = int.Parse(User.FindFirst("id")!.Value);

            var reports = await _db.WeeklyReports
                .Where(r =>
                    r.ProjectId == projectId &&
                    r.SupervisorId == supervisorId)
                .OrderByDescending(r => r.CreatedAt)
                .Select(r => new
                {
                    id = r.Id,
                    weekNumber = r.WeekNumber,
                    title = r.Title,
                    content = r.Content,
                    createdAt = r.CreatedAt
                })
                .ToListAsync();

            return Ok(reports);
        }

        // ==========================================
        // Supervisor Comments
        // ==========================================
        // ==========================================
        // Broadcast Supervisor Comment to all active projects of this supervisor
        // ==========================================
        [HttpPost("comments/broadcast")]
        [Authorize(Roles = "Supervisor")]
        public async Task<IActionResult> BroadcastSupervisorComment([FromBody] SupervisorCommentDto dto)
        {
            int supervisorId = int.Parse(User.FindFirst("id")!.Value);

            if (string.IsNullOrWhiteSpace(dto.Title) || string.IsNullOrWhiteSpace(dto.Content))
                return BadRequest(new { message = "عنوان ومحتوى الملاحظة مطلوبين" });

            var projectIds = await _db.Projects
                .Where(p => p.SupervisorId == supervisorId && p.Status == "Active")
                .Select(p => p.Id)
                .ToListAsync();

            if (projectIds.Count == 0)
                return BadRequest(new { message = "لا يوجد مشاريع نشطة لهذا المشرف" });

            var now = DateTime.UtcNow;
            var comments = projectIds.Select(pid => new SupervisorComment
            {
                ProjectId = pid,
                SupervisorId = supervisorId,
                Title = dto.Title ?? "",
                Content = dto.Content ?? "",
                CreatedAt = now
            }).ToList();

            _db.SupervisorComments.AddRange(comments);
            await _db.SaveChangesAsync();

            return Ok(new
            {
                message = "تم نشر الملاحظة على جميع المشاريع النشطة",
                projectsCount = projectIds.Count
            });
        }


        [HttpGet("{projectId}/comments")]
        [Authorize(Roles = "Supervisor")]
        public async Task<IActionResult> GetComments(int projectId)
        {
            int supervisorId = int.Parse(User.FindFirst("id")!.Value);

            var comments = await _db.SupervisorComments
                .Where(c =>
                    c.ProjectId == projectId &&
                    c.SupervisorId == supervisorId)
                .OrderByDescending(c => c.CreatedAt)
                .Select(c => new
                {
                    id = c.Id,
                    title = c.Title,
                    content = c.Content,
                    createdAt = c.CreatedAt
                })
                .ToListAsync();

            return Ok(comments);
        }

        // GET api/supervisor/projects?status=Active&q=...&page=1&limit=20
        [HttpGet]
        [Authorize(Roles = "Supervisor")]
        public async Task<IActionResult> GetSupervisorProjects(
            [FromQuery] string? status,
            [FromQuery] string? q,
            [FromQuery] int page = 1,
            [FromQuery] int limit = 20)
        {
            int supervisorId = int.Parse(User.FindFirst("id")!.Value);

            var query = _db.Projects
                .AsNoTracking()
                .Include(p => p.OwnerStudent)
                .Include(p => p.ProjectMembers)
                .Include(p => p.Milestones)
                .Where(p => p.SupervisorId == supervisorId);

            if (!string.IsNullOrWhiteSpace(status))
                query = query.Where(p => p.Status == status.Trim());

            if (!string.IsNullOrWhiteSpace(q))
            {
                var s = q.Trim().ToLower();
                query = query.Where(p =>
                    (p.Title ?? "").ToLower().Contains(s) ||
                    (p.Description ?? "").ToLower().Contains(s) ||
                    (p.OwnerStudent != null && (p.OwnerStudent.FullName ?? "").ToLower().Contains(s)) ||
                    (p.OwnerStudent != null && (p.OwnerStudent.Email ?? "").ToLower().Contains(s))
                );
            }

            page = page < 1 ? 1 : page;
            limit = (limit < 1 || limit > 100) ? 20 : limit;

            var total = await query.CountAsync();

            var items = await query
                .OrderByDescending(p => p.CreatedAt)
                .Skip((page - 1) * limit)
                .Take(limit)
                .Select(p => new
                {
                    projectId = p.Id,
                    title = p.Title,
                    description = p.Description,
                    status = p.Status,
                    createdAt = p.CreatedAt,

                    ownerStudentId = p.OwnerStudentId,
                    ownerName = p.OwnerStudent != null ? p.OwnerStudent.FullName : null,
                    ownerEmail = p.OwnerStudent != null ? p.OwnerStudent.Email : null,

                    teamCount = p.ProjectType == "Group"
                        ? p.ProjectMembers.Count(pm => pm.Status == "Accepted")
                        : 1,

                    // progress: نسبة milestones Done من مجموع milestones
                    progress = p.Milestones.Count == 0 ? 0 :
                        (int)Math.Round(
                            (double)p.Milestones.Count(m => m.Status == "Done") * 100.0 / p.Milestones.Count
                        ),

                    // أقرب deadline (أقرب EndAt لميلستون مفتوح/مجدول)
                    deadline = p.Milestones
                        .Where(m => m.EndAt.HasValue)
                        .OrderBy(m => m.EndAt)
                        .Select(m => m.EndAt)
                        .FirstOrDefault()
                })
                .ToListAsync();

            return Ok(new { page, limit, total, items });
        }

        // GET api/supervisor/projects/{projectId}/details
        [HttpGet("{projectId}/details")]
        [Authorize(Roles = "Supervisor")]
        public async Task<IActionResult> GetProjectDetailsForSupervisor(int projectId)
        {
            int supervisorId = int.Parse(User.FindFirst("id")!.Value);

            var project = await _db.Projects
                .AsNoTracking()
                .Include(p => p.OwnerStudent)
                .Include(p => p.ProjectMembers)
                    .ThenInclude(pm => pm.Student)
                .Include(p => p.Milestones)
                    .ThenInclude(m => m.Submissions)
                        .ThenInclude(s => s.Files)
                .FirstOrDefaultAsync(p => p.Id == projectId && p.SupervisorId == supervisorId);

            if (project == null)
                return NotFound(new { message = "المشروع غير موجود أو ليس ضمن مشاريع هذا المشرف" });

            var members = new List<object>();

            // Owner
            if (project.OwnerStudent != null)
            {
                members.Add(new
                {
                    studentId = project.OwnerStudent.Id,
                    name = project.OwnerStudent.FullName,
                    email = project.OwnerStudent.Email,
                    role = "Owner"
                });
            }

            // Accepted members (للمشاريع الجماعية)
            var acceptedMembers = project.ProjectMembers
                .Where(pm => pm.Status == "Accepted" && pm.Student != null)
                .Select(pm => new
                {
                    studentId = pm.StudentId,
                    name = pm.Student!.FullName,
                    email = pm.Student!.Email,
                    role = pm.RoleINProject,
                    isOwner = pm.IsOwner
                })
                .ToList();

            foreach (var m in acceptedMembers)
                members.Add(m);

            var milestones = project.Milestones
     .OrderBy(m => m.Order)
     .Select(m => new
     {
         milestoneId = m.Id,
         order = m.Order,
         name = m.Name,
         description = m.Description,
         status = m.Status,
         startAt = m.StartAt,
         endAt = m.EndAt,

         submissions = m.Submissions
             .OrderByDescending(s => s.UploadedAt)
             .Select(s => new
             {
                 submissionId = s.Id,
                 studentId = s.StudentId,
                 studentName = s.Student != null ? s.Student.FullName : null, // اذا عندك nav prop
                 status = s.Status,
                 uploadedAt = s.UploadedAt,
                 supervisorComment = s.SupervisorComment,
                 reviewedAt = s.ReviewedAt,
                 files = s.Files.Select(f => new
                 {
                     id = f.Id,
                     name = f.OriginalFileName,
                     sizeBytes = f.SizeBytes,
                     url = "/" + f.FilePath
                 }).ToList()
             })
             .ToList()
     })
     .ToList();

            // overall progress
            var totalMilestones = project.Milestones.Count;
            var doneMilestones = project.Milestones.Count(x => x.Status == "Done");
            var overallProgress = totalMilestones == 0 ? 0 : (int)Math.Round(doneMilestones * 100.0 / totalMilestones);

            return Ok(new
            {
                projectId = project.Id,
                title = project.Title,
                description = project.Description,
                status = project.Status,
                createdAt = project.CreatedAt,
                overallProgress,
                members,
                milestones
            });
        }






    }
}
