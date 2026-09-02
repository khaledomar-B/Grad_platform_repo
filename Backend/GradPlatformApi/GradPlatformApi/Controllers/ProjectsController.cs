using GradPlatformApi.Data;
using GradPlatformApi.Model.DTOs;
using GradPlatformApi.Model.Enum;
using GradPlatformApi.Model.Projects;
using GradPlatformApi.Services;                    // ✅ إضافة
using GradPlatformApi.Model.Communication;         // ✅ إضافة
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace GradPlatformApi.Controllers
{
    [ApiController]
    [Route("api/projects")]
    [Authorize(Roles = "student")]
    public class ProjectsController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly IWebHostEnvironment _env;
        private readonly NotificationService _notificationService;  // ✅ إضافة

        public ProjectsController(AppDbContext db, IWebHostEnvironment env, NotificationService notificationService) // ✅ تعديل
        {
            _db = db;
            _env = env;
            _notificationService = notificationService; // ✅ إضافة
        }

        // =====================================================
        // Create Project
        // =====================================================
        [HttpPost]
        public async Task<IActionResult> CreateProject(CreateProjectDto dto)
        {
            // التحقق من نوع المشروع 
            if (dto.ProjectType != "Individual" && dto.ProjectType != "Group")
                return BadRequest(new { message = "نوع المشروع غير صحيح" });

            // ✅ تحقق أن المشرف المختار موجود وموافق عليه
            var supervisor = await _db.supervisors
                .FirstOrDefaultAsync(s => s.Id == dto.SupervisorId && s.IsApproved);

            if (supervisor == null)
                return BadRequest(new { message = "المشرف المختار غير موجود أو غير مُعتمد." });

            int studentId = int.Parse(User.FindFirst("id")!.Value);

            // منع إنشاء أكثر من مشروع
            bool hasProject = await _db.Projects
                .AnyAsync(p => p.OwnerStudentId == studentId && p.Status != "Rejected");

            if (hasProject)
                return BadRequest(new { message = "لا يمكنك إنشاء أكثر من مشروع تخرج." });

            // إنشاء المشروع
            var project = new Project
            {
                Title = dto.Title,
                Description = dto.Description,
                ProjectType = dto.ProjectType,
                Status = "Pending",
                OwnerStudentId = studentId,
                Category = dto.Category,
                SupervisorId = null                // ✅ لسه ما وافق
            };

            _db.Projects.Add(project);
            await _db.SaveChangesAsync();

            // ✅ إذا مشروع جماعي: أضف المالك كعضو
            if (dto.ProjectType == "Group")
            {
                _db.ProjectMembers.Add(new ProjectMember
                {
                    ProjectId = project.Id,
                    StudentId = studentId,
                    RoleINProject = "Owner",
                    Status = "Accepted",
                    IsOwner = true
                });
                await _db.SaveChangesAsync();
            }

            // ✅ إنشاء طلب إشراف للمشرف المختار
            _db.SupervisorRequests.Add(new SupervisorRequest
            {
                ProjectId = project.Id,
                SupervisorId = dto.SupervisorId,
                Status = "Pending"
            });
            await _db.SaveChangesAsync();

            // إنشاء milestones
            var milestones = new List<Milestone>
            {
                new() { ProjectId = project.Id, Name = "Proposal",       Description = "Project Proposal",       Order = 1, Status = "Locked" },
                new() { ProjectId = project.Id, Name = "Requirements",   Description = "Requirements Analysis",  Order = 2, Status = "Locked" },
                new() { ProjectId = project.Id, Name = "Design",         Description = "System Design",          Order = 3, Status = "Locked" },
                new() { ProjectId = project.Id, Name = "Implementation", Description = "Implementation Phase",   Order = 4, Status = "Locked" },
                new() { ProjectId = project.Id, Name = "Testing",        Description = "Testing Phase",          Order = 5, Status = "Locked" },
                new() { ProjectId = project.Id, Name = "Presentation",   Description = "Final Presentation",     Order = 6, Status = "Locked" }
            };

            milestones[0].Status = "Locked";

            _db.Milestones.AddRange(milestones);
            await _db.SaveChangesAsync();

            return Ok(new
            {
                message = "تم إنشاء مشروع التخرج بنجاح وإرسال طلب الإشراف",
                projectId = project.Id
            });
        }

        // =====================================================
        // Add Member to Group Project
        // =====================================================
        [HttpPost("{projectId}/members")]
        public async Task<IActionResult> AddMember(int projectId, AddProjectMemberDto dto)
        {
            int currentStudentId = int.Parse(User.FindFirst("id")!.Value);

            // 1️⃣ التأكد أن المشروع موجود
            var project = await _db.Projects
                .Include(p => p.ProjectMembers)
                .FirstOrDefaultAsync(p => p.Id == projectId);

            if (project == null)
                return NotFound(new { message = "المشروع غير موجود" });

            // 2️⃣ التأكد أن المشروع جماعي
            if (project.ProjectType != "Group")
                return BadRequest(new { message = "لا يمكن إضافة أعضاء لمشروع فردي" });

            // 3️⃣ التأكد أن المستخدم Owner
            bool isOwner = project.ProjectMembers
                .Any(pm => pm.StudentId == currentStudentId && pm.IsOwner);

            if (!isOwner)
                return Forbid();

            // 4️⃣ الحد الأقصى 4
            if (project.ProjectMembers.Count >= 4)
                return BadRequest(new { message = "الحد الأقصى 4 طلاب" });

            // 5️⃣ عدم التكرار
            if (project.ProjectMembers.Any(pm => pm.StudentId == dto.StudentId))
                return BadRequest(new { message = "الطالب مضاف مسبقًا" });

            // 6️⃣ الطالب ما عنده مشروع ثاني
            bool hasProject = await _db.ProjectMembers
                .AnyAsync(pm => pm.StudentId == dto.StudentId && pm.Status == "Accepted");

            if (hasProject)
                return BadRequest(new { message = "الطالب مرتبط بمشروع آخر" });

            // 7️⃣ إضافة العضو
            _db.ProjectMembers.Add(new ProjectMember
            {
                ProjectId = projectId,
                StudentId = dto.StudentId,
                RoleINProject = "Member",
                Status = "Pending",
                IsOwner = false
            });

            await _db.SaveChangesAsync();

            // ✅ إشعار للطالب المدعو (TeamInviteReceived)
            try
            {
                await _notificationService.CreateAsync(
                    receiverId: dto.StudentId,
                    actorId: currentStudentId,
                    type: NotificationType.TeamInviteReceived,
                    title: "دعوة للانضمام لفريق",
                    message: $"تمت دعوتك للانضمام لفريق: {project.Title}",
                    data: new
                    {
                        projectId = project.Id,
                        url = "/team-invitations.html"
                    }
                );
            }
            catch { }

            return Ok(new { message = "تم إرسال دعوة الانضمام" });
        }

        // =====================================================
        // Accept Project Invitation
        // =====================================================
        [HttpPut("{projectId}/members/accept")]
        public async Task<IActionResult> AcceptInvitation(int projectId)
        {
            int studentId = int.Parse(User.FindFirst("id")!.Value);

            var member = await _db.ProjectMembers
                .Include(pm => pm.Project)
                .FirstOrDefaultAsync(pm =>
                    pm.ProjectId == projectId &&
                    pm.StudentId == studentId &&
                    pm.Status == "Pending");

            if (member == null)
                return NotFound(new { message = "لا توجد دعوة" });

            bool hasAcceptedProject = await _db.ProjectMembers
                .AnyAsync(pm => pm.StudentId == studentId && pm.Status == "Accepted");

            if (hasAcceptedProject)
                return BadRequest(new { message = "أنت مرتبط بمشروع آخر بالفعل" });

            member.Status = "Accepted";
            await _db.SaveChangesAsync();

            // ✅ إشعار لمالك الفريق أن الطالب قبل الدعوة
            try
            {
                if (member.Project != null && member.Project.OwnerStudentId.HasValue)
                {
                    await _notificationService.CreateAsync(
                        receiverId: member.Project.OwnerStudentId.Value,
                        actorId: studentId,
                        type: NotificationType.TeamInviteReceived,
                        title: "تم قبول دعوة الفريق",
                        message: $"قام طالب بقبول دعوة الانضمام لفريقك: {member.Project.Title}",
                        data: new
                        {
                            projectId = member.Project.Id,
                            url = $"/team-details.html?teamId={member.Project.Id}"
                        }
                    );
                }
            }
            catch { }

            return Ok(new { message = "تم الانضمام للمشروع" });
        }

        [HttpGet("invitations/my")]
        public async Task<IActionResult> GetMyInvitations()
        {
            int studentId = int.Parse(User.FindFirst("id")!.Value);

            var invitations = await _db.ProjectMembers
                .Include(pm => pm.Project)
                .Include(pm => pm.Project.ProjectMembers)
                    .ThenInclude(x => x.Student)
                .Where(pm => pm.StudentId == studentId && pm.Status == "Pending")
                .Select(pm => new
                {
                    projectId = pm.ProjectId,
                    projectTitle = pm.Project.Title,
                    projectDescription = pm.Project.Description,
                    fromOwner = pm.Project.ProjectMembers
                        .Where(x => x.IsOwner)
                        .Select(x => x.Student.FullName)
                        .FirstOrDefault(),
                })
                .ToListAsync();

            return Ok(new
            {
                count = invitations.Count,
                invitations
            });
        }

        [HttpPut("{projectId}/members/reject")]
        public async Task<IActionResult> RejectInvitation(int projectId)
        {
            int studentId = int.Parse(User.FindFirst("id")!.Value);

            var member = await _db.ProjectMembers
                .Include(pm => pm.Project)
                .FirstOrDefaultAsync(pm =>
                    pm.ProjectId == projectId &&
                    pm.StudentId == studentId &&
                    pm.Status == "Pending");

            if (member == null)
                return NotFound(new { message = "لا توجد دعوة" });

            _db.ProjectMembers.Remove(member);
            await _db.SaveChangesAsync();

            // ✅ إشعار لمالك الفريق أن الطالب رفض الدعوة
            try
            {
                if (member.Project != null && member.Project.OwnerStudentId.HasValue)
                {
                    await _notificationService.CreateAsync(
                        receiverId: member.Project.OwnerStudentId.Value,
                        actorId: studentId,
                        type: NotificationType.TeamInviteReceived,
                        title: "تم رفض دعوة الفريق",
                        message: $"قام طالب برفض دعوة الانضمام لفريقك: {member.Project.Title}",
                        data: new
                        {
                            projectId = member.Project.Id,
                            url = $"/team-details.html?teamId={member.Project.Id}"
                        }
                    );
                }
            }
            catch { }

            return Ok(new { message = "تم رفض الدعوة" });
        }

        [HttpGet("{projectId}/members/pending")]
        public async Task<IActionResult> GetPendingMembers(int projectId)
        {
            int currentStudentId = int.Parse(User.FindFirst("id")!.Value);

            var project = await _db.Projects
                .Include(p => p.ProjectMembers).ThenInclude(pm => pm.Student)
                .FirstOrDefaultAsync(p => p.Id == projectId);

            if (project == null)
                return NotFound(new { message = "المشروع غير موجود" });

            bool isOwner = project.ProjectMembers.Any(pm => pm.StudentId == currentStudentId && pm.IsOwner);
            if (!isOwner) return Forbid();

            var pending = project.ProjectMembers
                .Where(pm => pm.Status == "Pending" && !pm.IsOwner)
                .Select(pm => new
                {
                    studentId = pm.StudentId,
                    studentName = pm.Student.FullName,
                    role = pm.RoleINProject,
                    status = pm.Status
                })
                .ToList();

            return Ok(new { count = pending.Count, pending });
        }

        [HttpDelete("{projectId}/members/{studentId}")]
        public async Task<IActionResult> CancelInvitation(int projectId, int studentId)
        {
            int currentStudentId = int.Parse(User.FindFirst("id")!.Value);

            var project = await _db.Projects
                .Include(p => p.ProjectMembers)
                .FirstOrDefaultAsync(p => p.Id == projectId);

            if (project == null)
                return NotFound(new { message = "المشروع غير موجود" });

            bool isOwner = project.ProjectMembers.Any(pm => pm.StudentId == currentStudentId && pm.IsOwner);
            if (!isOwner) return Forbid();

            var member = await _db.ProjectMembers.FirstOrDefaultAsync(pm =>
                pm.ProjectId == projectId &&
                pm.StudentId == studentId &&
                pm.Status == "Pending");

            if (member == null)
                return NotFound(new { message = "لا توجد دعوة لإلغائها" });

            _db.ProjectMembers.Remove(member);
            await _db.SaveChangesAsync();

            // ✅ إشعار للطالب أن الدعوة انلغت
            try
            {
                await _notificationService.CreateAsync(
                    receiverId: studentId,
                    actorId: currentStudentId,
                    type: NotificationType.TeamInviteReceived,
                    title: "تم إلغاء دعوة الفريق",
                    message: $"تم إلغاء دعوتك للانضمام لفريق: {project.Title}",
                    data: new
                    {
                        projectId = project.Id,
                        url = "/team-invitations.html"
                    }
                );
            }
            catch { }

            return Ok(new { message = "تم إلغاء الدعوة" });
        }

        // =====================================================
        // Get My Project (Dashboard)
        // =====================================================
        [HttpGet("my")]
        public async Task<IActionResult> GetMyProject()
        {
            int studentId = int.Parse(User.FindFirst("id")!.Value);

            var project = await _db.Projects
                .Include(p => p.ProjectMembers).ThenInclude(pm => pm.Student)
                .Include(p => p.Milestones)
                    .ThenInclude(m => m.Submissions)
                        .ThenInclude(s => s.Files)
                .FirstOrDefaultAsync(p =>
                    p.OwnerStudentId == studentId ||
                    p.ProjectMembers.Any(pm => pm.StudentId == studentId && pm.Status == "Accepted"));

            if (project == null)
                return NotFound(new { message = "لا يوجد مشروع مرتبط بهذا الطالب" });

            var response = new
            {
                projectId = project.Id,
                title = project.Title,
                description = project.Description,
                projectType = project.ProjectType,
                status = project.Status,
                createdAt = project.CreatedAt,

                members = project.ProjectMembers.Select(pm => new
                {
                    studentId = pm.StudentId,
                    studentName = pm.Student.FullName,
                    role = pm.RoleINProject,
                    status = pm.Status,
                    isOwner = pm.IsOwner
                }),

                milestones = project.Milestones
                    .OrderBy(m => m.Order)
                    .Select(m => new
                    {
                        milestoneId = m.Id,
                        order = m.Order,
                        name = m.Name,
                        description = m.Description,

                        status =
                            (!m.StartAt.HasValue || !m.EndAt.HasValue) ? "Locked"
                            : (DateTime.UtcNow < m.StartAt.Value) ? "Locked"
                            : (DateTime.UtcNow > m.EndAt.Value) ? "Locked"
                            : "Open",

                        startDate = m.StartAt,
                        endDate = m.EndAt,

                        mySubmission = m.Submissions
                            .Where(s => s.StudentId == studentId)
                            .OrderByDescending(s => s.UploadedAt)
                            .Select(s => new
                            {
                                submissionId = s.Id,
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
                            .FirstOrDefault()
                    })
                    .ToList()
            };

            return Ok(response);
        }

        // =====================================================
        // Submit Milestone (Submission Endpoint)
        // =====================================================
        [HttpPost("milestones/{milestoneId}/submit")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> SubmitMilestone(int milestoneId, [FromForm] SubmitMilestoneDto dto)
        {
            var files = dto.Files;
            if (files == null || files.Count == 0)
                return BadRequest(new { message = "يرجى رفع ملف" });

            int studentId = int.Parse(User.FindFirst("id")!.Value);

            var milestone = await _db.Milestones
                .Include(m => m.Project)
                .FirstOrDefaultAsync(m => m.Id == milestoneId);

            if (milestone == null)
                return NotFound(new { message = "المرحلة غير موجودة" });

            var project = milestone.Project;

            bool inProject =
                project.OwnerStudentId == studentId ||
                await _db.ProjectMembers.AnyAsync(pm => pm.ProjectId == project.Id && pm.StudentId == studentId);

            if (!inProject) return Forbid();

            if (project.Status != "Active")
                return BadRequest(new { message = "المشروع غير مفعل بعد" });

            var now = DateTime.UtcNow;

            if (!milestone.StartAt.HasValue || !milestone.EndAt.HasValue)
                return BadRequest(new { message = "مواعيد التسليم غير محددة بعد" });

            if (now < milestone.StartAt.Value)
                return BadRequest(new { message = "مرحلة التسليم لم تبدأ بعد" });

            if (now > milestone.EndAt.Value)
                return BadRequest(new { message = "انتهى وقت التسليم لهذه المرحلة" });

            // مسار الرفع
            var uploadsPath = Path.Combine(_env.ContentRootPath, "Uploads", "Submissions");
            Directory.CreateDirectory(uploadsPath);

            // آخر Submission للطالب على هالمرحلة (إذا موجود)
            var submission = await _db.submissions
                .Include(s => s.Files)
                .FirstOrDefaultAsync(s => s.MilestoneId == milestoneId && s.StudentId == studentId);

            bool isNew = false;
            if (submission == null)
            {
                isNew = true;
                submission = new Submission
                {
                    ProjectId = project.Id,
                    MilestoneId = milestone.Id,
                    StudentId = studentId,
                    Status = "Submitted",
                    UploadedAt = now,
                    Files = new List<SubmissionFile>()
                };
            }
            else
            {
                submission.Status = "Submitted";
                submission.UploadedAt = now;
            }

            var mode = (dto.Mode ?? "append").Trim().ToLower();

            // ✅ replace: امسح القديم من الدسك + DB
            if (!isNew && mode == "replace")
            {
                foreach (var old in submission.Files.ToList())
                {
                    try
                    {
                        var abs = Path.Combine(_env.ContentRootPath, old.FilePath.Replace("/", Path.DirectorySeparatorChar.ToString()));
                        if (System.IO.File.Exists(abs))
                            System.IO.File.Delete(abs);
                    }
                    catch { }

                    _db.SubmissionFiles.Remove(old);
                }
                submission.Files.Clear();
            }

            // ✅ أضف الملفات الجديدة
            foreach (var file in files)
            {
                if (file == null || file.Length == 0) continue;

                var safeFileName = $"{Guid.NewGuid()}_{Path.GetFileName(file.FileName)}";
                var fullPath = Path.Combine(uploadsPath, safeFileName);

                using (var stream = new FileStream(fullPath, FileMode.Create))
                    await file.CopyToAsync(stream);

                submission.Files.Add(new SubmissionFile
                {
                    FilePath = Path.Combine("Uploads", "Submissions", safeFileName).Replace("\\", "/"),
                    OriginalFileName = file.FileName,
                    SizeBytes = file.Length
                });
            }

            if (isNew) _db.submissions.Add(submission);

            // (اختياري) حدّث milestone.Status
            milestone.Status = "Submitted";
            // ✅ Upsert ProjectSubmissionTexts (يحفظ نص المرحلة)
            var text = (dto.TextContent ?? "").Trim();

            if (!string.IsNullOrWhiteSpace(text))
            {
                var stepNumber = milestone.Order; // لازم Order يكون 1..7
                if (stepNumber > 0)
                {
                    var existingText = await _db.ProjectSubmissionTexts
                        .FirstOrDefaultAsync(x => x.ProjectId == project.Id && x.StepNumber == stepNumber);

                    if (existingText == null)
                    {
                        _db.ProjectSubmissionTexts.Add(new ProjectSubmissionText
                        {
                            ProjectId = project.Id,
                            StepNumber = stepNumber,
                            Title = milestone.Name ?? $"Step {stepNumber}",
                            Content = text,
                            UpdatedAtUtc = DateTime.UtcNow
                        });
                    }
                    else
                    {
                        existingText.Title = milestone.Name ?? existingText.Title;
                        existingText.Content = text;
                        existingText.UpdatedAtUtc = DateTime.UtcNow;
                    }

                    await _db.SaveChangesAsync();
                }
            }



            await _db.SaveChangesAsync();

            // ===========================
            // ✅ Notifications (NEW)
            // ===========================
            try
            {
                // المستلمين: owner + أعضاء المشروع المقبولين
                var receiverIds = new HashSet<int>();

                if (project.OwnerStudentId.HasValue)
                {
                    receiverIds.Add(project.OwnerStudentId.Value);
                }

                var acceptedMemberIds = await _db.ProjectMembers
                    .Where(pm => pm.ProjectId == project.Id && pm.Status == "Accepted")
                    .Select(pm => pm.StudentId)
                    .ToListAsync();

                foreach (var mid in acceptedMemberIds)
                    receiverIds.Add(mid);

                // استثناء صاحب التسليم
                //receiverIds.Remove(studentId);

                foreach (var rid in receiverIds)
                {
                    await _notificationService.CreateAsync(
                        receiverId: rid,
                        actorId: studentId,
                        type: NotificationType.SubmissionAdded,
                        title: "تم إضافة تسليم جديد",
                        message: $"تم رفع تسليم جديد لمرحلة: {milestone.Name}",
                        data: new
                        {
                            projectId = project.Id,
                            milestoneId = milestone.Id,
                            submissionId = submission.Id,
                            url = $"/progress-phases.html?projectId={project.Id}&milestoneId={milestone.Id}"
                        }
                    );
                }
            }
            catch
            {
                // لا توقف عملية التسليم لو الإشعارات فشلت
            }

            return Ok(new
            {
                message = "تم تسليم المرحلة بنجاح",
                submissionId = submission.Id,
                uploadedAt = submission.UploadedAt,
                files = submission.Files.Select(f => new
                {
                    id = f.Id,
                    name = f.OriginalFileName,
                    sizeBytes = f.SizeBytes,
                    url = "/" + f.FilePath
                })
            });
        }

        [HttpDelete("submissions/files/{fileId}")]
        public async Task<IActionResult> DeleteSubmissionFile(int fileId)
        {
            int studentId = int.Parse(User.FindFirst("id")!.Value);

            var file = await _db.SubmissionFiles
                .Include(f => f.Submission)
                    .ThenInclude(s => s.Project)
                .Include(f => f.Submission)
                    .ThenInclude(s => s.Milestone)
                .FirstOrDefaultAsync(f => f.Id == fileId);

            if (file == null)
                return NotFound(new { message = "الملف غير موجود" });

            if (file.Submission.StudentId != studentId)
                return Forbid();

            var project = file.Submission.Project;
            bool inProject =
                project.OwnerStudentId == studentId ||
                await _db.ProjectMembers.AnyAsync(pm => pm.ProjectId == project.Id && pm.StudentId == studentId);

            if (!inProject) return Forbid();

            try
            {
                var abs = Path.Combine(_env.ContentRootPath, file.FilePath.Replace("/", Path.DirectorySeparatorChar.ToString()));
                if (System.IO.File.Exists(abs))
                    System.IO.File.Delete(abs);
            }
            catch { }

            _db.SubmissionFiles.Remove(file);
            await _db.SaveChangesAsync();

            var subId = file.SubmissionId;
            var sub = await _db.submissions
                .Include(s => s.Files)
                .Include(s => s.Milestone)
                .FirstOrDefaultAsync(s => s.Id == subId);

            if (sub != null && (sub.Files == null || sub.Files.Count == 0))
            {
                _db.submissions.Remove(sub);

                var now = DateTime.UtcNow;
                if (sub.Milestone.StartAt.HasValue && sub.Milestone.EndAt.HasValue &&
                    now >= sub.Milestone.StartAt.Value && now <= sub.Milestone.EndAt.Value)
                {
                    sub.Milestone.Status = "Open";
                }

                await _db.SaveChangesAsync();
            }

            return Ok(new { message = "تم حذف الملف" });
        }

        [HttpDelete("milestones/{milestoneId}/submission")]
        public async Task<IActionResult> DeleteMySubmission(int milestoneId)
        {
            int studentId = int.Parse(User.FindFirst("id")!.Value);

            var milestone = await _db.Milestones
                .Include(m => m.Project)
                .Include(m => m.Submissions)
                    .ThenInclude(s => s.Files)
                .FirstOrDefaultAsync(m => m.Id == milestoneId);

            if (milestone == null)
                return NotFound(new { message = "المرحلة غير موجودة" });

            var project = milestone.Project;

            bool inProject =
                project.OwnerStudentId == studentId ||
                await _db.ProjectMembers.AnyAsync(pm => pm.ProjectId == project.Id && pm.StudentId == studentId);

            if (!inProject) return Forbid();

            if (project.Status != "Active")
                return BadRequest(new { message = "المشروع غير مفعل بعد" });

            var sub = milestone.Submissions
                .Where(s => s.StudentId == studentId)
                .OrderByDescending(s => s.UploadedAt)
                .FirstOrDefault();

            if (sub == null)
                return NotFound(new { message = "لا يوجد تسليم لحذفه" });

            if (sub.Status == "Approved")
                return BadRequest(new { message = "لا يمكن حذف تسليم تمت الموافقة عليه" });

            var now = DateTime.UtcNow;
            if (milestone.EndAt.HasValue && now > milestone.EndAt.Value)
                return BadRequest(new { message = "انتهى وقت المرحلة ولا يمكن حذف التسليم" });

            foreach (var f in sub.Files.ToList())
            {
                var abs = Path.Combine(_env.ContentRootPath,
                    f.FilePath.Replace("/", Path.DirectorySeparatorChar.ToString()));
                if (System.IO.File.Exists(abs))
                    System.IO.File.Delete(abs);
            }

            _db.SubmissionFiles.RemoveRange(sub.Files);
            _db.submissions.Remove(sub);

            milestone.Status = "Open";

            await _db.SaveChangesAsync();

            return Ok(new { message = "تم حذف التسليم بنجاح" });
        }

        // =====================================================
        // Get Project Documents
        // =====================================================
        [HttpGet("{projectId}/documents")]
        public async Task<IActionResult> GetProjectDocuments(int projectId)
        {
            int studentId = int.Parse(User.FindFirst("id")!.Value);

            var project = await _db.Projects
                .Include(p => p.ProjectMembers)
                .Include(p => p.Milestones)
                    .ThenInclude(m => m.Submissions)
                        .ThenInclude(s => s.Files)
                .FirstOrDefaultAsync(p => p.Id == projectId);

            if (project == null)
                return NotFound(new { message = "المشروع غير موجود" });

            bool inProject =
                project.OwnerStudentId == studentId ||
                project.ProjectMembers.Any(pm => pm.StudentId == studentId);

            if (!inProject) return Forbid();

            var sections = new Dictionary<string, List<object>>
            {
                ["proposal"] = new(),
                ["requirements"] = new(),
                ["design"] = new(),
                ["development"] = new(),
                ["presentations"] = new(),
                ["Final"] = new()
            };

            static string KeyFromMilestoneOrder(int? order) => order switch
            {
                1 => "proposal",
                2 => "requirements",
                3 => "design",
                4 => "development",
                5 => "development",
                6 => "presentations",
                7 => "Final",
                _ => "Final"
            };

            foreach (var m in project.Milestones.OrderBy(x => x.Order))
            {
                var key = KeyFromMilestoneOrder(m.Order);

                var latestPerStudent = m.Submissions
                    .GroupBy(s => s.StudentId)
                    .Select(g => g.OrderByDescending(x => x.UploadedAt).First());

                foreach (var sub in latestPerStudent)
                {
                    foreach (var f in sub.Files)
                    {
                        sections[key].Add(new
                        {
                            fileId = f.Id,
                            name = f.OriginalFileName,
                            sizeBytes = f.SizeBytes,
                            url = "/" + f.FilePath,

                            milestoneId = m.Id,
                            milestoneOrder = m.Order,
                            milestoneName = m.Name,

                            submissionId = sub.Id,
                            submissionStatus = sub.Status,
                            studentId = sub.StudentId,
                            uploadedAt = sub.UploadedAt
                        });
                    }
                }
            }

            var counts = sections.ToDictionary(k => k.Key, v => v.Value.Count);
            var total = counts.Values.Sum();

            return Ok(new { projectId, total, counts, sections });
        }

        // =====================================================
        // Technologies
        // =====================================================
        [HttpGet("{projectId}/technologies")]
        public async Task<IActionResult> GetProjectTechnologies(int projectId)
        {
            int studentId = int.Parse(User.FindFirst("id")!.Value);

            var project = await _db.Projects
                .Include(p => p.ProjectMembers)
                .FirstOrDefaultAsync(p => p.Id == projectId);

            if (project == null) return NotFound(new { message = "المشروع غير موجود" });

            bool inProject =
                project.OwnerStudentId == studentId ||
                project.ProjectMembers.Any(pm => pm.StudentId == studentId);

            if (!inProject) return Forbid();

            var techs = await _db.ProjectTechnologies
                .Where(t => t.ProjectId == projectId)
                .OrderByDescending(t => t.CreatedAt)
                .Select(t => new
                {
                    id = t.Id,
                    category = t.Category.ToString(),
                    name = t.Name,
                    createdAt = t.CreatedAt
                })
                .ToListAsync();

            var counts = techs
                .GroupBy(t => t.category)
                .ToDictionary(g => g.Key, g => g.Count());

            return Ok(new { projectId, techs, counts, total = techs.Count });
        }

        [HttpPost("{projectId}/technologies")]
        public async Task<IActionResult> AddTechnology(int projectId, [FromBody] AddTechnologyDto dto)
        {
            int studentId = int.Parse(User.FindFirst("id")!.Value);

            var project = await _db.Projects
                .Include(p => p.ProjectMembers)
                .FirstOrDefaultAsync(p => p.Id == projectId);

            if (project == null) return NotFound(new { message = "المشروع غير موجود" });

            bool inProject =
                project.OwnerStudentId == studentId ||
                project.ProjectMembers.Any(pm => pm.StudentId == studentId);

            if (!inProject) return Forbid();

            var name = (dto.Name ?? "").Trim();
            if (name.Length < 2) return BadRequest(new { message = "اسم التقنية غير صالح" });

            bool exists = await _db.ProjectTechnologies.AnyAsync(t =>
                t.ProjectId == projectId &&
                t.Category == dto.Category &&
                t.Name.ToLower() == name.ToLower());

            if (exists) return Ok(new { message = "التقنية موجودة مسبقًا" });

            var tech = new ProjectTechnology
            {
                ProjectId = projectId,
                Category = dto.Category,
                Name = name
            };

            _db.ProjectTechnologies.Add(tech);
            await _db.SaveChangesAsync();

            return Ok(new
            {
                message = "تمت إضافة التقنية",
                tech = new { id = tech.Id, category = tech.Category.ToString(), name = tech.Name }
            });
        }

        [HttpDelete("technologies/{techId}")]
        public async Task<IActionResult> DeleteTechnology(int techId)
        {
            int studentId = int.Parse(User.FindFirst("id")!.Value);

            var tech = await _db.ProjectTechnologies
                .Include(t => t.Project)
                    .ThenInclude(p => p.ProjectMembers)
                .FirstOrDefaultAsync(t => t.Id == techId);

            if (tech == null) return NotFound(new { message = "التقنية غير موجودة" });

            var project = tech.Project;

            bool inProject =
                project.OwnerStudentId == studentId ||
                project.ProjectMembers.Any(pm => pm.StudentId == studentId);

            if (!inProject) return Forbid();

            _db.ProjectTechnologies.Remove(tech);
            await _db.SaveChangesAsync();

            return Ok(new { message = "تم حذف التقنية" });
        }

        // =====================================================
        // Links
        // =====================================================
        [HttpGet("{projectId}/links")]
        public async Task<IActionResult> GetProjectLinks(int projectId)
        {
            int studentId = int.Parse(User.FindFirst("id")!.Value);

            var project = await _db.Projects
                .Include(p => p.ProjectMembers)
                .FirstOrDefaultAsync(p => p.Id == projectId);

            if (project == null) return NotFound(new { message = "المشروع غير موجود" });

            bool inProject =
                project.OwnerStudentId == studentId ||
                project.ProjectMembers.Any(pm => pm.StudentId == studentId);

            if (!inProject) return Forbid();

            var items = await _db.ProjectLinks
                .Where(x => x.ProjectId == projectId)
                .ToListAsync();

            var result = new Dictionary<string, string>();
            foreach (var l in items)
                result[l.Type.ToString().ToLower()] = l.Url;

            return Ok(new { projectId, links = result });
        }

        [HttpPost("{projectId}/links")]
        public async Task<IActionResult> UpsertProjectLink(int projectId, [FromBody] UpsertProjectLinkDto dto)
        {
            int studentId = int.Parse(User.FindFirst("id")!.Value);

            var project = await _db.Projects
                .Include(p => p.ProjectMembers)
                .FirstOrDefaultAsync(p => p.Id == projectId);

            if (project == null) return NotFound(new { message = "المشروع غير موجود" });

            bool inProject =
                project.OwnerStudentId == studentId ||
                project.ProjectMembers.Any(pm => pm.StudentId == studentId);

            if (!inProject) return Forbid();

            var url = (dto.Url ?? "").Trim();
            if (url.Length < 5 || !Uri.TryCreate(url, UriKind.Absolute, out _))
                return BadRequest(new { message = "الرابط غير صالح" });

            var existing = await _db.ProjectLinks
                .FirstOrDefaultAsync(x => x.ProjectId == projectId && x.Type == dto.Type);

            if (existing == null)
            {
                existing = new ProjectLink
                {
                    ProjectId = projectId,
                    Type = dto.Type,
                    Url = url,
                    UpdatedAt = DateTime.UtcNow
                };
                _db.ProjectLinks.Add(existing);
            }
            else
            {
                existing.Url = url;
                existing.UpdatedAt = DateTime.UtcNow;
            }

            await _db.SaveChangesAsync();

            return Ok(new
            {
                message = "تم حفظ الرابط",
                link = new { id = existing.Id, type = existing.Type.ToString().ToLower(), url = existing.Url }
            });
        }

        [HttpDelete("{projectId}/links/{type}")]
        public async Task<IActionResult> DeleteProjectLink(int projectId, string type)
        {
            int studentId = int.Parse(User.FindFirst("id")!.Value);

            var project = await _db.Projects
                .Include(p => p.ProjectMembers)
                .FirstOrDefaultAsync(p => p.Id == projectId);

            if (project == null) return NotFound(new { message = "المشروع غير موجود" });

            bool inProject =
                project.OwnerStudentId == studentId ||
                project.ProjectMembers.Any(pm => pm.StudentId == studentId);

            if (!inProject) return Forbid();

            if (!Enum.TryParse<ProjectLinkType>(type, true, out var t))
                return BadRequest(new { message = "نوع الرابط غير صحيح" });

            var link = await _db.ProjectLinks.FirstOrDefaultAsync(x => x.ProjectId == projectId && x.Type == t);
            if (link == null) return NotFound(new { message = "الرابط غير موجود" });

            _db.ProjectLinks.Remove(link);
            await _db.SaveChangesAsync();

            return Ok(new { message = "تم حذف الرابط" });
        }

        [HttpPost("{milestoneId:int}/submit-text")]
        public async Task<IActionResult> SubmitMilestoneText(int milestoneId, [FromBody] SubmitMilestoneTextRequestDto req)
        {
            if (req?.Outputs == null || req.Outputs.Count == 0)
                return BadRequest(new { message = "outputs مطلوب" });

            int studentId = int.Parse(User.FindFirst("id")!.Value);

            // 1) جيب milestone + تأكد الطالب إله صلاحية عليه
            // عدّل أسماء الجداول/الحقول حسب مشروعك إذا اختلفت
            var milestone = await _db.Milestones
                .AsNoTracking()
                .FirstOrDefaultAsync(m => m.Id == milestoneId || m.Id == milestoneId);

            if (milestone == null)
                return NotFound(new { message = "Milestone غير موجود" });

            int projectId = milestone.ProjectId;

            // ✅ صلاحية: صاحب المشروع أو عضو مقبول
            var canAccess =
                await _db.Projects.AnyAsync(p => p.Id == projectId && p.OwnerStudentId == studentId)
                || await _db.ProjectMembers.AnyAsync(pm =>
                    pm.ProjectId == projectId && pm.StudentId == studentId && pm.Status == "Accepted");

            if (!canAccess) return Forbid();

            // 2) مخرجات المرحلة الأولى (5)
            var titles = new[]
            {
                "Title and short description",
                "Problem and proposed solution",
                "Expected objectives",
                "Tools and technologies",
                "Initial timeline"
            };

            // 3) Upsert لكل StepNumber (1..5)
            // outputs keys are 0..4
            for (int i = 0; i < 5; i++)
            {
                var key = i.ToString();
                req.Outputs.TryGetValue(key, out var content);
                content ??= "";

                int stepNumber = i + 1;

                var existing = await _db.ProjectSubmissionTexts
                    .FirstOrDefaultAsync(x => x.ProjectId == projectId && x.StepNumber == stepNumber);

                if (existing == null)
                {
                    _db.ProjectSubmissionTexts.Add(new ProjectSubmissionText
                    {
                        ProjectId = projectId,
                        StepNumber = stepNumber,
                        Title = titles[i],
                        Content = content,
                        StudentId = studentId,
                        UpdatedAtUtc = DateTime.UtcNow
                    });
                }
                else
                {
                    existing.Title = titles[i];
                    existing.Content = content;
                    existing.StudentId = studentId;
                    existing.UpdatedAtUtc = DateTime.UtcNow;
                }
            }

            await _db.SaveChangesAsync();

            return Ok(new { message = "✅ تم حفظ مخرجات المرحلة الأولى بنجاح", projectId });
        }
    }
}
