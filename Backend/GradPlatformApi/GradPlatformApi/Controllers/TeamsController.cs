using GradPlatformApi.Data;
using GradPlatformApi.Model.Projects;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Linq;

using GradPlatformApi.Services;
using GradPlatformApi.Model.Communication;

namespace GradPlatformApi.Controllers
{
    [ApiController]
    [Route("api/teams")]
    [Authorize]
    public class TeamsController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly NotificationService _notificationService;

        public TeamsController(AppDbContext db, NotificationService notificationService)
        {
            _db = db;
            _notificationService = notificationService;
        }

        [HttpGet("overview")]
        public async Task<IActionResult> GetTeamsOverview()
        {
            int myStudentId = int.Parse(User.FindFirst("id")!.Value);

            var projects = await _db.Projects
                .Include(p => p.ProjectMembers)
                    .ThenInclude(pm => pm.Student)
                .ToListAsync();

            var ownerIds = projects
                .Where(p => p.OwnerStudentId.HasValue)
                .Select(p => p.OwnerStudentId!.Value)
                .Distinct()
                .ToList();

            var owners = await _db.Students
                .Where(s => ownerIds.Contains(s.Id))
                .Select(s => new { s.Id, s.FullName })
                .ToListAsync();

            var ownerMap = owners.ToDictionary(x => x.Id, x => x.FullName);

            var teams = projects.Select(p =>
            {
                var members = new List<object>();

                if (p.OwnerStudentId.HasValue && ownerMap.TryGetValue(p.OwnerStudentId.Value, out var ownerName))
                {
                    members.Add(new
                    {
                        studentId = p.OwnerStudentId.Value,
                        name = ownerName,
                        initial = string.IsNullOrWhiteSpace(ownerName) ? "?" : ownerName.Trim()[0].ToString(),
                        me = p.OwnerStudentId.Value == myStudentId
                    });
                }

                foreach (var pm in p.ProjectMembers.Where(x => x.Status == "Accepted"))
                {
                    if (p.OwnerStudentId.HasValue && pm.StudentId == p.OwnerStudentId.Value) continue;
                    var n = pm.Student?.FullName ?? "—";

                    members.Add(new
                    {
                        studentId = pm.StudentId,
                        name = n,
                        initial = string.IsNullOrWhiteSpace(n) ? "?" : n.Trim()[0].ToString(),
                        me = pm.StudentId == myStudentId
                    });
                }

                const int membersLimit = 4;

                return new
                {
                    id = p.Id,
                    name = p.Title ?? "—",
                    description = p.Description ?? "",
                    membersLimit,
                    members
                };
            }).ToList();

            var memberIds = projects
                .SelectMany(p => p.ProjectMembers.Select(pm => pm.StudentId))
                .Distinct()
                .ToHashSet();

            var allTeamRelatedIds = ownerIds
                .Concat(memberIds)
                .Distinct()
                .ToHashSet();

            var soloStudents = await _db.Students
                .Where(s => !allTeamRelatedIds.Contains(s.Id))
                .Select(s => new
                {
                    studentId = s.Id,
                    name = s.FullName,
                    initial = string.IsNullOrWhiteSpace(s.FullName) ? "?" : s.FullName.Trim()[0].ToString(),
                    major = "",
                    skills = Array.Empty<string>()
                })
                .ToListAsync();

            return Ok(new
            {
                teams,
                soloStudents
            });
        }

        [HttpPost("{teamId}/join-request")]
        [Authorize(Roles = "student")]
        public async Task<IActionResult> RequestToJoinTeam(int teamId)
        {
            int studentId = int.Parse(User.FindFirst("id")!.Value);

            // ✅ 1) إذا الطالب عنده مشروع Owner عليه و Status = Pending → احذفه (عشان يقدر ينضم لفريق)
            var myPendingProject = await _db.Projects
                .FirstOrDefaultAsync(p => p.OwnerStudentId == studentId && p.Status == "Pending");

            if (myPendingProject != null)
            {
                var supReqs = await _db.SupervisorRequests
                    .Where(r => r.ProjectId == myPendingProject.Id)
                    .ToListAsync();
                _db.SupervisorRequests.RemoveRange(supReqs);

                var members = await _db.ProjectMembers
                    .Where(pm => pm.ProjectId == myPendingProject.Id)
                    .ToListAsync();
                _db.ProjectMembers.RemoveRange(members);

                var milestones = await _db.Milestones
                    .Where(m => m.ProjectId == myPendingProject.Id)
                    .ToListAsync();
                _db.Milestones.RemoveRange(milestones);

                var links = await _db.ProjectLinks
                    .Where(l => l.ProjectId == myPendingProject.Id)
                    .ToListAsync();
                _db.ProjectLinks.RemoveRange(links);

                var techs = await _db.ProjectTechnologies
                    .Where(t => t.ProjectId == myPendingProject.Id)
                    .ToListAsync();
                _db.ProjectTechnologies.RemoveRange(techs);

                _db.Projects.Remove(myPendingProject);

                await _db.SaveChangesAsync();
            }

            // ✅ 2) امنع إذا الطالب Owner على مشروع Active/غير Pending
            bool ownsActiveProject = await _db.Projects.AnyAsync(p =>
                p.OwnerStudentId == studentId &&
                p.Status != "Pending" &&
                p.Status != "Rejected");

            if (ownsActiveProject)
                return BadRequest(new { message = "أنت مرتبط بمشروع آخر بالفعل" });

            // ✅ 3) جيب الفريق المطلوب
            var project = await _db.Projects
                .Include(p => p.ProjectMembers)
                .FirstOrDefaultAsync(p => p.Id == teamId);

            if (project == null)
                return NotFound(new { message = "الفريق غير موجود" });

            if (project.ProjectType != "Group")
                return BadRequest(new { message = "هذا المشروع ليس فريقًا جماعيًا" });

            if (project.OwnerStudentId == studentId)
                return BadRequest(new { message = "أنت صاحب هذا الفريق بالفعل" });

            bool already = await _db.ProjectMembers.AnyAsync(pm =>
                pm.ProjectId == teamId && pm.StudentId == studentId);

            if (already)
                return BadRequest(new { message = "لديك طلب سابق أو أنت عضو بالفعل" });

            bool hasAcceptedActiveProject = await _db.ProjectMembers
                .Include(pm => pm.Project)
                .AnyAsync(pm =>
                    pm.StudentId == studentId &&
                    pm.Status == "Accepted" &&
                    pm.Project.Status != "Pending");

            if (hasAcceptedActiveProject)
                return BadRequest(new { message = "أنت مرتبط بمشروع آخر بالفعل" });

            const int membersLimit = 4;
            int acceptedCount = project.ProjectMembers.Count(pm => pm.Status == "Accepted");
            int currentCount = acceptedCount + (project.OwnerStudentId.HasValue ? 1 : 0);

            if (currentCount >= membersLimit)
                return BadRequest(new { message = "الفريق مكتمل" });

            _db.ProjectMembers.Add(new ProjectMember
            {
                ProjectId = teamId,
                StudentId = studentId,
                RoleINProject = "Member",
                Status = "Pending",
                IsOwner = false
            });

            await _db.SaveChangesAsync();

            // ✅ إشعار لصاحب الفريق بوصول طلب انضمام (بعد حفظ الطلب)
            try
            {
                if (project.OwnerStudentId.HasValue)
                {
                    await _notificationService.CreateAsync(
                        receiverId: project.OwnerStudentId.Value,
                        actorId: studentId,
                        type: NotificationType.TeamJoinRequestReceived,
                        title: "طلب انضمام جديد",
                        message: $"وصل طلب انضمام جديد لفريقك: {project.Title}",
                        data: new
                        {
                            teamId = project.Id,
                            studentId = studentId,
                            url = "/team-requests.html"
                        }
                    );
                }
            }
            catch { }

            return Ok(new { message = "تم إرسال طلب الانضمام للفريق" });
        }

        [HttpGet("join-requests/owner")]
        [Authorize(Roles = "student")]
        public async Task<IActionResult> GetJoinRequestsForMyTeams()
        {
            int ownerId = int.Parse(User.FindFirst("id")!.Value);

            var myTeams = await _db.Projects
                .Where(p => p.ProjectType == "Group" &&
                            (p.OwnerStudentId == ownerId ||
                             p.ProjectMembers.Any(pm => pm.StudentId == ownerId && pm.IsOwner)))
                .Select(p => p.Id)
                .ToListAsync();

            if (myTeams.Count == 0)
                return Ok(new { count = 0, items = Array.Empty<object>() });

            var items = await _db.ProjectMembers
                .Include(pm => pm.Student)
                .Include(pm => pm.Project)
                .Where(pm => myTeams.Contains(pm.ProjectId) &&
                             pm.Status == "Pending" &&
                             !pm.IsOwner)
                .OrderByDescending(pm => pm.Id)
                .Select(pm => new
                {
                    teamId = pm.ProjectId,
                    teamName = pm.Project.Title,
                    teamDescription = pm.Project.Description,

                    studentId = pm.StudentId,
                    studentName = pm.Student != null ? pm.Student.FullName : "—",

                    status = pm.Status,
                })
                .ToListAsync();

            return Ok(new { count = items.Count, items });
        }

        [HttpPost("{teamId}/join-requests/{studentId}/accept")]
        [Authorize(Roles = "student")]
        public async Task<IActionResult> AcceptJoinRequest(int teamId, int studentId)
        {
            int ownerId = int.Parse(User.FindFirst("id")!.Value);

            var project = await _db.Projects
                .Include(p => p.ProjectMembers)
                .FirstOrDefaultAsync(p => p.Id == teamId);

            if (project == null)
                return NotFound(new { message = "الفريق غير موجود" });

            bool isOwner =
                project.OwnerStudentId == ownerId ||
                project.ProjectMembers.Any(pm => pm.StudentId == ownerId && pm.IsOwner);

            if (!isOwner) return Forbid();

            const int membersLimit = 4;
            int acceptedCount = project.ProjectMembers.Count(pm => pm.Status == "Accepted");
            int currentCount = acceptedCount + (project.OwnerStudentId.HasValue ? 1 : 0);
            if (currentCount >= membersLimit)
                return BadRequest(new { message = "الفريق مكتمل" });

            var member = await _db.ProjectMembers.FirstOrDefaultAsync(pm =>
                pm.ProjectId == teamId && pm.StudentId == studentId && pm.Status == "Pending");

            if (member == null)
                return NotFound(new { message = "لا يوجد طلب انضمام معلق لهذا الطالب" });

            bool hasAcceptedActiveProject = await _db.ProjectMembers
                .Include(pm => pm.Project)
                .AnyAsync(pm =>
                    pm.StudentId == studentId &&
                    pm.Status == "Accepted" &&
                    pm.Project.Status != "Pending");

            if (hasAcceptedActiveProject)
                return BadRequest(new { message = "الطالب مرتبط بمشروع آخر بالفعل" });

            member.Status = "Accepted";
            await _db.SaveChangesAsync();

            // ✅ إشعار للطالب بقبول طلبه
            try
            {
                await _notificationService.CreateAsync(
                    receiverId: studentId,
                    actorId: ownerId,
                    type: NotificationType.TeamJoinRequestReceived,
                    title: "تم قبول طلب الانضمام",
                    message: $"تم قبول طلب انضمامك إلى فريق: {project.Title}",
                    data: new
                    {
                        teamId = project.Id,
                        url = $"/teams.html?teamId={project.Id}"
                    }
                );
            }
            catch { }

            return Ok(new { message = "تم قبول طلب الانضمام" });
        }

        [HttpPost("{teamId}/join-requests/{studentId}/reject")]
        [Authorize(Roles = "student")]
        public async Task<IActionResult> RejectJoinRequest(int teamId, int studentId)
        {
            int ownerId = int.Parse(User.FindFirst("id")!.Value);

            var project = await _db.Projects
                .Include(p => p.ProjectMembers)
                .FirstOrDefaultAsync(p => p.Id == teamId);

            if (project == null)
                return NotFound(new { message = "الفريق غير موجود" });

            bool isOwner =
                project.OwnerStudentId == ownerId ||
                project.ProjectMembers.Any(pm => pm.StudentId == ownerId && pm.IsOwner);

            if (!isOwner) return Forbid();

            var member = await _db.ProjectMembers.FirstOrDefaultAsync(pm =>
                pm.ProjectId == teamId && pm.StudentId == studentId && pm.Status == "Pending");

            if (member == null)
                return NotFound(new { message = "لا يوجد طلب انضمام معلق لهذا الطالب" });

            _db.ProjectMembers.Remove(member);
            await _db.SaveChangesAsync();

            // ✅ إشعار للطالب برفض طلبه
            try
            {
                await _notificationService.CreateAsync(
                    receiverId: studentId,
                    actorId: ownerId,
                    type: NotificationType.TeamJoinRequestReceived,
                    title: "تم رفض طلب الانضمام",
                    message: $"تم رفض طلب انضمامك إلى فريق: {project.Title}",
                    data: new
                    {
                        teamId = project.Id,
                        url = "/teams.html"
                    }
                );
            }
            catch { }

            return Ok(new { message = "تم رفض طلب الانضمام" });
        }
    }
}
