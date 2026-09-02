using GradPlatformApi.Data;
using GradPlatformApi.Model.DTOs;
using GradPlatformApi.Model.Projects;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace GradPlatformApi.Controllers
{
    [ApiController]
    [Route("api/supervisor/phases")]
    [Authorize(Roles = "Supervisor")]
    public class SupervisorPhasesManagerController : ControllerBase
    {
        private readonly AppDbContext _db;

        public SupervisorPhasesManagerController(AppDbContext db)
        {
            _db = db;
        }

        // ==========================================
        // 1) Get supervisor projects (for dropdown)
        // GET /api/supervisor/phases/projects
        // ==========================================
        [HttpGet("projects")]
        public async Task<IActionResult> GetMyProjects()
        {
            int supervisorId = int.Parse(User.FindFirst("id")!.Value);

            // مشاريع هذا المشرف (Active غالباً) - عدّل status حسب احتياجك
            var projects = await _db.Projects
                .AsNoTracking()
                .Where(p => p.SupervisorId == supervisorId && p.Status == "Active")
                .OrderByDescending(p => p.CreatedAt)
                .Select(p => new
                {
                    id = p.Id,
                    name = p.Title ?? "—",
                    // إذا عندك Major بمكان آخر عدلها
                    major = ""
                })
                .ToListAsync();

            return Ok(projects);
        }

        // ==========================================
        // 2) Get milestones/phases for project
        // GET /api/supervisor/phases/projects/{projectId}/milestones
        // ==========================================
        [HttpGet("projects/{projectId}/milestones")]
        public async Task<IActionResult> GetProjectMilestones(int projectId)
        {
            int supervisorId = int.Parse(User.FindFirst("id")!.Value);

            var project = await _db.Projects
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.Id == projectId && p.SupervisorId == supervisorId);

            if (project == null)
                return NotFound(new { message = "المشروع غير موجود أو ليس ضمن مشاريع هذا المشرف" });

            var milestones = await _db.Milestones
                .AsNoTracking()
                .Where(m => m.ProjectId == projectId)
                .OrderBy(m => m.Order)
                .Select(m => new
                {
                    id = m.Id,
                    order = m.Order,
                    title = m.Name ?? "—",
                    description = m.Description ?? "",
                    deadline = m.EndAt, // UI يسميها deadline
                    status = MapDbStatusToUi(m.Status),
                    deliverables = _db.MilestoneDeliverables
                        .Where(d => d.MilestoneId == m.Id)
                        .OrderBy(d => d.SortOrder)
                        .Select(d => d.Label)
                        .ToList()
                })
                .ToListAsync();

            return Ok(new
            {
                projectId = project.Id,
                projectName = project.Title ?? "—",
                phases = milestones
            });
        }

        // ==========================================
        // 3) Create new milestone/phase
        // POST /api/supervisor/phases/projects/{projectId}/milestones
        // ==========================================
        [HttpPost("projects/{projectId}/milestones")]
        public async Task<IActionResult> CreateMilestone(int projectId, [FromBody] CreateMilestoneDto dto)
        {
            int supervisorId = int.Parse(User.FindFirst("id")!.Value);

            var project = await _db.Projects
                .FirstOrDefaultAsync(p => p.Id == projectId && p.SupervisorId == supervisorId);

            if (project == null)
                return NotFound(new { message = "المشروع غير موجود أو ليس ضمن مشاريع هذا المشرف" });

            var name = (dto.Name ?? "").Trim();
            if (string.IsNullOrWhiteSpace(name))
                return BadRequest(new { message = "اسم المرحلة مطلوب" });

            if (dto.Order < 1) dto.Order = 1;

            // اختياري: منع order مكرر (أو اسمح وخلّي UI يرتب)
            // هنا رح نسمح، بس تقدر تعمل shift للأوامر إذا بدك.

            var m = new Milestone
            {
                ProjectId = projectId,
                Order = dto.Order,
                Name = name,
                Description = (dto.Description ?? "").Trim(),
                EndAt = dto.Deadline,     // deadline
                StartAt = null,           // الصفحة هاي ما بتستخدم StartAt
                Status = MapUiStatusToDb(dto.Status) // default locked لو null
            };

            _db.Milestones.Add(m);
            await _db.SaveChangesAsync();

            return Ok(new
            {
                message = "تم إضافة المرحلة",
                phase = new
                {
                    id = m.Id,
                    order = m.Order,
                    title = m.Name,
                    description = m.Description,
                    deadline = m.EndAt,
                    status = MapDbStatusToUi(m.Status),
                    deliverables = Array.Empty<string>()
                }
            });
        }

        // ==========================================
        // 4) Toggle phase status (locked -> active -> completed -> locked)
        // PUT /api/supervisor/phases/projects/{projectId}/milestones/{milestoneId}/toggle-status
        // ==========================================
        [HttpPut("projects/{projectId}/milestones/{milestoneId}/toggle-status")]
        public async Task<IActionResult> ToggleMilestoneStatus(int projectId, int milestoneId)
        {
            int supervisorId = int.Parse(User.FindFirst("id")!.Value);

            var projectOk = await _db.Projects.AnyAsync(p =>
                p.Id == projectId && p.SupervisorId == supervisorId);

            if (!projectOk)
                return NotFound(new { message = "المشروع غير موجود أو ليس ضمن مشاريع هذا المشرف" });

            var milestone = await _db.Milestones
                .FirstOrDefaultAsync(m => m.Id == milestoneId && m.ProjectId == projectId);

            if (milestone == null)
                return NotFound(new { message = "المرحلة غير موجودة" });

            var ui = MapDbStatusToUi(milestone.Status);

            // locked -> active -> completed -> locked
            ui = ui switch
            {
                "locked" => "active",
                "active" => "completed",
                _ => "locked"
            };

            milestone.Status = MapUiStatusToDb(ui);
            await _db.SaveChangesAsync();

            return Ok(new
            {
                message = "تم تغيير حالة المرحلة",
                status = ui
            });
        }

        // ==========================================
        // 5) Delete phase
        // DELETE /api/supervisor/phases/projects/{projectId}/milestones/{milestoneId}
        // ==========================================
        [HttpDelete("projects/{projectId}/milestones/{milestoneId}")]
        public async Task<IActionResult> DeleteMilestone(int projectId, int milestoneId)
        {
            int supervisorId = int.Parse(User.FindFirst("id")!.Value);

            var projectOk = await _db.Projects.AnyAsync(p =>
                p.Id == projectId && p.SupervisorId == supervisorId);

            if (!projectOk)
                return NotFound(new { message = "المشروع غير موجود أو ليس ضمن مشاريع هذا المشرف" });

            var milestone = await _db.Milestones
                .FirstOrDefaultAsync(m => m.Id == milestoneId && m.ProjectId == projectId);

            if (milestone == null)
                return NotFound(new { message = "المرحلة غير موجودة" });

            // احذف المخرجات التابعة
            var dels = await _db.MilestoneDeliverables
                .Where(d => d.MilestoneId == milestoneId)
                .ToListAsync();

            _db.MilestoneDeliverables.RemoveRange(dels);
            _db.Milestones.Remove(milestone);

            await _db.SaveChangesAsync();

            return Ok(new { message = "تم حذف المرحلة" });
        }

        // ==========================================
        // 6) Add deliverable to milestone
        // POST /api/supervisor/phases/milestones/{milestoneId}/deliverables
        // ==========================================
        [HttpPost("milestones/{milestoneId}/deliverables")]
        public async Task<IActionResult> AddDeliverable(int milestoneId, [FromBody] AddDeliverableDto dto)
        {
            int supervisorId = int.Parse(User.FindFirst("id")!.Value);

            var label = (dto.Label ?? "").Trim();
            if (string.IsNullOrWhiteSpace(label))
                return BadRequest(new { message = "اسم المخرج مطلوب" });

            // تحقق من ملكية المشرف للمشروع
            var milestone = await _db.Milestones
                .Include(m => m.Project)
                .FirstOrDefaultAsync(m => m.Id == milestoneId);

            if (milestone == null)
                return NotFound(new { message = "المرحلة غير موجودة" });

            if (milestone.Project == null || milestone.Project.SupervisorId != supervisorId)
                return Forbid();

            var maxOrder = await _db.MilestoneDeliverables
                .Where(d => d.MilestoneId == milestoneId)
                .Select(d => (int?)d.SortOrder)
                .MaxAsync() ?? -1;

            var d1 = new MilestoneDeliverable
            {
                MilestoneId = milestoneId,
                Label = label,
                SortOrder = maxOrder + 1
            };

            _db.MilestoneDeliverables.Add(d1);
            await _db.SaveChangesAsync();

            return Ok(new
            {
                message = "تم إضافة المخرج",
                deliverable = new { id = d1.Id, label = d1.Label, index = d1.SortOrder }
            });
        }

        // ==========================================
        // 7) Remove deliverable by index (matches your UI)
        // DELETE /api/supervisor/phases/milestones/{milestoneId}/deliverables/by-index?index=0
        // ==========================================
        [HttpDelete("milestones/{milestoneId}/deliverables/by-index")]
        public async Task<IActionResult> RemoveDeliverableByIndex(int milestoneId, [FromQuery] int index)
        {
            int supervisorId = int.Parse(User.FindFirst("id")!.Value);

            if (index < 0)
                return BadRequest(new { message = "index غير صحيح" });

            var milestone = await _db.Milestones
                .Include(m => m.Project)
                .FirstOrDefaultAsync(m => m.Id == milestoneId);

            if (milestone == null)
                return NotFound(new { message = "المرحلة غير موجودة" });

            if (milestone.Project == null || milestone.Project.SupervisorId != supervisorId)
                return Forbid();

            var list = await _db.MilestoneDeliverables
                .Where(d => d.MilestoneId == milestoneId)
                .OrderBy(d => d.SortOrder)
                .ToListAsync();

            if (index >= list.Count)
                return NotFound(new { message = "لا يوجد مخرج بهذا index" });

            var target = list[index];
            _db.MilestoneDeliverables.Remove(target);

            // إعادة ترقيم sortOrder حتى يظل index صحيح بالـ UI
            for (int i = 0; i < list.Count; i++)
            {
                if (list[i].Id == target.Id) continue;
                // بعد الحذف: خلي الترتيب 0..n-1
            }

            await _db.SaveChangesAsync();

            // إعادة تحميل وترتيب بعد الحذف لتحديث sortOrder
            var remain = await _db.MilestoneDeliverables
                .Where(d => d.MilestoneId == milestoneId)
                .OrderBy(d => d.SortOrder)
                .ToListAsync();

            for (int i = 0; i < remain.Count; i++)
                remain[i].SortOrder = i;

            await _db.SaveChangesAsync();

            return Ok(new { message = "تم حذف المخرج" });
        }

        // ======================
        // Helpers: Status mapping
        // ======================
        private static string MapDbStatusToUi(string? dbStatus)
        {
            var s = (dbStatus ?? "").Trim().ToLower();

            // حسب شغلك السابق في Submission: Done/Open/Locked
            // هنا نحولهم لواجهة S_PhasesManager: completed/active/locked
            return s switch
            {
                "done" => "completed",
                "open" => "active",
                "locked" => "locked",
                "active" => "active",
                "completed" => "completed",
                _ => "locked"
            };
        }

        private static string MapUiStatusToDb(string? uiStatus)
        {
            var s = (uiStatus ?? "").Trim().ToLower();

            return s switch
            {
                "completed" => "Done",
                "active" => "Open",
                "locked" => "Locked",
                _ => "Locked"
            };
        }
    }
}
