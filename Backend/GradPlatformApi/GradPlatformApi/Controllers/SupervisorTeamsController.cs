using GradPlatformApi.Data;
using GradPlatformApi.Model.Projects;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace GradPlatformApi.Controllers
{
    [ApiController]
    [Route("api/supervisor/teams")]
    [Authorize(Roles = "Supervisor")]
    public class SupervisorTeamsController : ControllerBase
    {
        private readonly AppDbContext _db;

        public SupervisorTeamsController(AppDbContext db)
        {
            _db = db;
        }

        // =========================
        // GET overview (teams + studentsWithoutTeam)
        // =========================
        [HttpGet("overview")]
        public async Task<IActionResult> GetOverview()
        {
            int supervisorId = int.Parse(User.FindFirst("id")!.Value);

            // ✅ فقط مشاريع هذا المشرف + فقط Group
            var projects = await _db.Projects
                .Where(p => p.SupervisorId == supervisorId && p.ProjectType == "Group")
                .Include(p => p.ProjectMembers)
                    .ThenInclude(pm => pm.Student)
                .ToListAsync();

            // owners
            var ownerIds = projects
                .Where(p => p.OwnerStudentId.HasValue)
                .Select(p => p.OwnerStudentId!.Value)
                .Distinct()
                .ToList();

            var owners = await _db.Students
                .Where(s => ownerIds.Contains(s.Id))
                .Select(s => new { s.Id, s.FullName })
                .ToListAsync();

            var ownerMap = owners.ToDictionary(x => x.Id, x => x.FullName ?? "—");

            const int membersLimit = 4;

            var teams = projects.Select(p =>
            {
                var members = new List<object>();

                // owner
                if (p.OwnerStudentId.HasValue && ownerMap.TryGetValue(p.OwnerStudentId.Value, out var ownerName))
                {
                    members.Add(new
                    {
                        studentId = p.OwnerStudentId.Value,
                        name = ownerName,
                        initial = string.IsNullOrWhiteSpace(ownerName) ? "?" : ownerName.Trim()[0].ToString(),
                        role = "Owner"
                    });
                }

                // accepted members
                foreach (var pm in p.ProjectMembers.Where(x => x.Status == "Accepted"))
                {
                    if (p.OwnerStudentId.HasValue && pm.StudentId == p.OwnerStudentId.Value) continue;

                    var n = pm.Student?.FullName ?? "—";
                    members.Add(new
                    {
                        studentId = pm.StudentId,
                        name = n,
                        initial = string.IsNullOrWhiteSpace(n) ? "?" : n.Trim()[0].ToString(),
                        role = "Member"
                    });
                }

                return new
                {
                    id = p.Id,
                    name = p.Title ?? "—",
                    description = p.Description ?? "",
                    membersLimit,
                    members
                };
            }).ToList();

            // ✅ كل الطلاب اللي هم أصلًا ضمن فرق هذا المشرف (Owner + Accepted members)
            var inAnyTeamIds = new HashSet<int>();
            foreach (var p in projects)
            {
                if (p.OwnerStudentId.HasValue) inAnyTeamIds.Add(p.OwnerStudentId.Value);
                foreach (var pm in p.ProjectMembers.Where(x => x.Status == "Accepted"))
                    inAnyTeamIds.Add(pm.StudentId);
            }

            // ✅ studentsWithoutTeam:
            // حسب نظامك: يا إمّا من نفس الجامعة، أو كل الطلاب…
            // أنا عملتها: طلاب غير موجودين بأي فريق عند هذا المشرف.
            var studentsWithoutTeam = await _db.Students
                .Where(s => !inAnyTeamIds.Contains(s.Id))
                .Select(s => new
                {
                    id = s.Id,
                    name = s.FullName ?? "—",
                    major = s.Major ?? ""
                })
                .ToListAsync();

            return Ok(new { teams, studentsWithoutTeam });
        }

        // =========================
        // POST add member
        // =========================
        public class AddMemberDto { public int StudentId { get; set; } }

        [HttpPost("{teamId:int}/members")]
        public async Task<IActionResult> AddMember(int teamId, [FromBody] AddMemberDto dto)
        {
            int supervisorId = int.Parse(User.FindFirst("id")!.Value);

            var project = await _db.Projects
                .Include(p => p.ProjectMembers)
                .FirstOrDefaultAsync(p => p.Id == teamId && p.SupervisorId == supervisorId && p.ProjectType == "Group");

            if (project == null) return NotFound(new { message = "Team not found" });

            const int membersLimit = 4;
            int acceptedCount = project.ProjectMembers.Count(pm => pm.Status == "Accepted");
            int currentCount = acceptedCount + (project.OwnerStudentId.HasValue ? 1 : 0);
            if (currentCount >= membersLimit) return BadRequest(new { message = "Team is full" });

            // ✅ ممنوع تضيف Owner كـ member
            if (project.OwnerStudentId.HasValue && project.OwnerStudentId.Value == dto.StudentId)
                return BadRequest(new { message = "Student is already the owner" });

            // ✅ إذا الطالب موجود أصلاً (pending/accepted) منع
            bool already = await _db.ProjectMembers.AnyAsync(pm =>
                pm.ProjectId == teamId && pm.StudentId == dto.StudentId);

            if (already) return BadRequest(new { message = "Student already exists in this team" });

            // ✅ منع الطالب يكون Accepted بفريق ثاني عند نفس المشرف (اختياري)
            bool inOtherTeam = await _db.ProjectMembers
                .Include(pm => pm.Project)
                .AnyAsync(pm =>
                    pm.StudentId == dto.StudentId &&
                    pm.Status == "Accepted" &&
                    pm.Project.SupervisorId == supervisorId &&
                    pm.Project.ProjectType == "Group" &&
                    pm.ProjectId != teamId);

            if (inOtherTeam) return BadRequest(new { message = "Student is already in another team" });

            _db.ProjectMembers.Add(new ProjectMember
            {
                ProjectId = teamId,
                StudentId = dto.StudentId,
                RoleINProject = "Member",
                Status = "Accepted",   // ✅ مشرف يضيف مباشرة (بدون Pending)
                IsOwner = false
            });

            await _db.SaveChangesAsync();
            return Ok(new { message = "Member added" });
        }

        // =========================
        // POST transfer
        // =========================
        public class TransferDto
        {
            public int StudentId { get; set; }
            public int FromTeamId { get; set; }
            public int ToTeamId { get; set; }
        }

        [HttpPost("transfer")]
        public async Task<IActionResult> Transfer([FromBody] TransferDto dto)
        {
            int supervisorId = int.Parse(User.FindFirst("id")!.Value);

            // تأكد الفريقين تبعون نفس المشرف
            var from = await _db.Projects
                .Include(p => p.ProjectMembers)
                .FirstOrDefaultAsync(p => p.Id == dto.FromTeamId && p.SupervisorId == supervisorId && p.ProjectType == "Group");

            var to = await _db.Projects
                .Include(p => p.ProjectMembers)
                .FirstOrDefaultAsync(p => p.Id == dto.ToTeamId && p.SupervisorId == supervisorId && p.ProjectType == "Group");

            if (from == null || to == null) return NotFound(new { message = "Team not found" });

            // ممنوع نقل Owner
            if (from.OwnerStudentId == dto.StudentId) return BadRequest(new { message = "Cannot transfer team owner" });

            var member = await _db.ProjectMembers.FirstOrDefaultAsync(pm =>
                pm.ProjectId == dto.FromTeamId && pm.StudentId == dto.StudentId && pm.Status == "Accepted");

            if (member == null) return NotFound(new { message = "Member not found in source team" });

            const int membersLimit = 4;
            int toAccepted = to.ProjectMembers.Count(pm => pm.Status == "Accepted");
            int toCount = toAccepted + (to.OwnerStudentId.HasValue ? 1 : 0);
            if (toCount >= membersLimit) return BadRequest(new { message = "Target team is full" });

            // نقل: حذف من from وإضافة to (أو تعديل ProjectId)
            member.ProjectId = dto.ToTeamId;

            await _db.SaveChangesAsync();
            return Ok(new { message = "Member transferred" });
        }

        // =========================
        // DELETE remove member
        // =========================
        [HttpDelete("{teamId:int}/members/{studentId:int}")]
        public async Task<IActionResult> RemoveMember(int teamId, int studentId)
        {
            int supervisorId = int.Parse(User.FindFirst("id")!.Value);

            var project = await _db.Projects
                .FirstOrDefaultAsync(p => p.Id == teamId && p.SupervisorId == supervisorId && p.ProjectType == "Group");

            if (project == null) return NotFound(new { message = "Team not found" });

            if (project.OwnerStudentId == studentId) return BadRequest(new { message = "Cannot remove team owner" });

            var member = await _db.ProjectMembers.FirstOrDefaultAsync(pm =>
                pm.ProjectId == teamId && pm.StudentId == studentId && pm.Status == "Accepted");

            if (member == null) return NotFound(new { message = "Member not found" });

            _db.ProjectMembers.Remove(member);
            await _db.SaveChangesAsync();

            return Ok(new { message = "Member removed" });
        }
    }
}
