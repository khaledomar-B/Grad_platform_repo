using GradPlatformApi.Data;
using GradPlatformApi.Model.DTOs;
using GradPlatformApi.Model.Projects;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace GradPlatformApi.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class MessagesController : ControllerBase
    {
        private readonly AppDbContext _db;

        public MessagesController(AppDbContext db)
        {
            _db = db;
        }

        private int GetUserId()
        {
            var idClaim = User.FindFirst("id")?.Value;
            if (string.IsNullOrWhiteSpace(idClaim))
                throw new UnauthorizedAccessException("Missing user id claim");

            return int.Parse(idClaim);
        }

        private string GetUserRole()
        {
            return User.FindFirst(ClaimTypes.Role)?.Value ?? "";
        }

        // ✅ يتحقق إذا المستخدم طالب عضو بالمشروع أو مشرف عليه
        private async Task<bool> CanAccessProject(int projectId, int userId, string role)
        {
            // Supervisor
            if (role.Equals("Supervisor", StringComparison.OrdinalIgnoreCase))
            {
                return await _db.Projects.AnyAsync(p => p.Id == projectId && p.SupervisorId == userId);
            }

            // Student
            return await _db.ProjectMembers.AnyAsync(pm => pm.ProjectId == projectId && pm.StudentId == userId);
        }

        // ----------------------------------------------------------------
        // 1) GET: api/messages/my-projects
        // يرجّع المشاريع اللي تخص المستخدم (طالب/مشرف) لعرضها بالـ sidebar
        // ----------------------------------------------------------------
        [HttpGet("my-projects")]
        public async Task<IActionResult> GetMyProjects()
        {
            int userId = GetUserId();
            string role = GetUserRole();

            if (role.Equals("Supervisor", StringComparison.OrdinalIgnoreCase))
            {
                var projects = await _db.Projects
                    .Where(p => p.SupervisorId == userId)
                    .OrderByDescending(p => p.CreatedAt)
                    .Select(p => new
                    {
                        id = p.Id,
                        title = p.Title
                    })
                    .ToListAsync();

                return Ok(projects);
            }

            // Student
            var myProjects = await _db.ProjectMembers
                .Where(pm => pm.StudentId == userId)
                .Select(pm => new
                {
                    id = pm.Project.Id,
                    title = pm.Project.Title
                })
                .Distinct()
                .ToListAsync();

            return Ok(myProjects);
        }

        // ----------------------------------------------------------------
        // 2) GET: api/messages/project/{projectId}
        // جلب رسائل مشروع
        // ----------------------------------------------------------------
        [HttpGet("project/{projectId}")]
        public async Task<IActionResult> GetProjectMessages(int projectId)
        {
            int userId = GetUserId();
            string role = GetUserRole();

            if (!await CanAccessProject(projectId, userId, role))
                return Forbid();

            var messages = await _db.ProjectMessages
                .Where(m => m.ProjectId == projectId)
                .OrderBy(m => m.SentAt)
               .Select(m => new
               {
                   id = m.Id,
                   projectId = m.ProjectId,
                   senderId = m.SenderId,
                   senderRole = m.SenderRole,
                   senderName =
        m.SenderRole == "Supervisor"
            ? _db.supervisors.Where(s => s.Id == m.SenderId)
                .Select(s => (s.FirstName + " " + s.LastName))
                .FirstOrDefault()
            : _db.Students.Where(s => s.Id == m.SenderId)
                .Select(s => s.FullName)
                .FirstOrDefault(),
                   content = m.Content,
                   sentAt = m.SentAt
               })

                .ToListAsync();

            return Ok(messages);
        }

        // ----------------------------------------------------------------
        // 3) POST: api/messages/project/{projectId}
        // إرسال رسالة
        // ----------------------------------------------------------------
        [HttpPost("project/{projectId}")]
        public async Task<IActionResult> SendMessage(int projectId, [FromBody] SendMessageDto dto)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var content = dto.Content?.Trim();
            if (string.IsNullOrWhiteSpace(content))
                return BadRequest(new { message = "الرسالة فارغة." });

            int userId = GetUserId();
            string role = GetUserRole();

            if (!await CanAccessProject(projectId, userId, role))
                return Forbid();

            var message = new ProjectMessage
            {
                ProjectId = projectId,
                SenderId = userId,
                SenderRole = role, // "student" أو "Supervisor"
                Content = content,
                SentAt = DateTime.UtcNow
            };

            _db.ProjectMessages.Add(message);
            await _db.SaveChangesAsync();

            return Ok(new
            {
                id = message.Id,
                projectId = message.ProjectId,
                senderId = message.SenderId,
                senderRole = message.SenderRole,
                content = message.Content,
                sentAt = message.SentAt
            });
        }
        // ----------------------------------------------------------------
        // GET: api/messages/project/{projectId}/header
        // يرجّع معلومات الهيدر (نوع المشروع + الأعضاء + المشرف)
        // ----------------------------------------------------------------
        [HttpGet("project/{projectId}/header")]
        public async Task<IActionResult> GetProjectHeader(int projectId)
        {
            int userId = GetUserId();
            string role = GetUserRole();

            if (!await CanAccessProject(projectId, userId, role))
                return Forbid();

            var project = await _db.Projects
                .Where(p => p.Id == projectId)
                .Select(p => new
                {
                    id = p.Id,
                    title = p.Title,
                    projectType = p.ProjectType, // "Individual" / "Group" أو "Individual" / "Team"
                    supervisorId = p.SupervisorId,
                })
                .FirstOrDefaultAsync();

            if (project == null)
                return NotFound(new { message = "Project not found." });

            // اسم المشرف
            string? supervisorName = null;
            if (project.supervisorId != null)
            {
                supervisorName = await _db.supervisors
                    .Where(s => s.Id == project.supervisorId.Value)
                    .Select(s => s.FirstName + " " + s.LastName)
                    .FirstOrDefaultAsync();
            }

            // أسماء الطلاب (أعضاء المشروع)
            var members = await _db.ProjectMembers
                .Where(pm => pm.ProjectId == projectId && pm.Status == "Accepted")
                .Select(pm => new
                {
                    id = pm.StudentId,
                    name = pm.Student.FullName,
                    isOwner = pm.IsOwner
                })
                .OrderByDescending(x => x.isOwner)
                .ThenBy(x => x.name)
                .ToListAsync();

            return Ok(new
            {
                projectId = project.id,
                title = project.title,
                projectType = project.projectType,
                supervisor = new
                {
                    id = project.supervisorId,
                    name = supervisorName
                },
                members
            });
        }

    }
}
