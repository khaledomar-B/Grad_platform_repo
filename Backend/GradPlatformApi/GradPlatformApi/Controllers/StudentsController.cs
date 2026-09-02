using GradPlatformApi.Data;
using GradPlatformApi.Model.DTOs;
using GradPlatformApi.Model.Skills;
using GradPlatformApi.Model.Users;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace GradPlatformApi.Controllers
{
    [ApiController]
    [Route("api/students")]
    [Authorize(Roles = "student")]
    public class StudentsController : ControllerBase
    {
        private readonly AppDbContext _db;

        public StudentsController(AppDbContext db)
        {
            _db = db;
        }

        // =====================================================
        // Search Students (supports searching by skills too)
        // - returns only students allowed to join:
        //   (No Accepted in Active project)
        // =====================================================
        [HttpGet("search")]
        public async Task<IActionResult> SearchStudents([FromQuery] string? query)
        {
            int currentStudentId = int.Parse(User.FindFirst("id")!.Value);

            query = (query ?? "").Trim();
            string q = query.ToLower();

            var students = await _db.Students
                .AsNoTracking()
                .Include(s => s.Skills)
                    .ThenInclude(ss => ss.Skill)
                .Where(s => s.Id != currentStudentId)
                .Where(s =>
                    string.IsNullOrEmpty(q)
                    || (s.FullName != null && s.FullName.ToLower().Contains(q))
                    || (s.Email != null && s.Email.ToLower().Contains(q))
                    || (s.UniversityId != null && s.UniversityId.ToLower().Contains(q))
                    || s.Skills.Any(ss => ss.Skill.Name.ToLower().Contains(q))
                )
                // ✅ exclude: Accepted + Active فقط
                .Where(s => !_db.ProjectMembers.Any(pm =>
                    pm.StudentId == s.Id &&
                    pm.Status == "Accepted" &&
                    pm.Project.Status == "Active"
                ))
                .Select(s => new
                {
                    studentId = s.Id,
                    name = s.FullName,
                    email = s.Email,
                    universityId = s.UniversityId,
                    major = s.Major,
                    skills = s.Skills
                        .Select(ss => ss.Skill.Name)
                        .Distinct()
                        .ToList()
                })
                .Take(50) // بدل 10 عشان القائمة ما تختفي بسرعة
                .ToListAsync();

            return Ok(students);
        }

        // =====================================================
        // Teammates Overview
        // - totalStudents: عدد الطلاب كلهم
        // - availableStudents: الطلاب المسموح لهم بالانضمام (Pending أو No Project)
        // =====================================================
        [HttpGet("teammates/overview")]
        public async Task<IActionResult> GetTeammatesOverview()
        {
            int currentStudentId = int.Parse(User.FindFirst("id")!.Value);

            // العدد الكلي بكل النظام (يشمل الطالب الحالي)
            var totalStudents = await _db.Students.CountAsync();

            // كل الطلاب (عدا الحالي) + available flag
            var students = await _db.Students
                .AsNoTracking()
                .Include(s => s.Skills)
                    .ThenInclude(ss => ss.Skill)
                .Where(s => s.Id != currentStudentId)
                .Select(s => new
                {
                    studentId = s.Id,
                    name = s.FullName,
                    email = s.Email,
                    major = s.Major,
                    skills = s.Skills
                        .Select(ss => ss.Skill.Name)
                        .Distinct()
                        .ToList(),

                    // ✅ الطالب متاح إذا ما عنده Accepted داخل مشروع Active
                    available = !_db.ProjectMembers.Any(pm =>
                        pm.StudentId == s.Id &&
                        pm.Status == "Accepted" &&
                        pm.Project.Status == "Active"
                    )
                })
                .ToListAsync();

            var availableStudentsCount = students.Count(s => s.available);

            return Ok(new
            {
                totalStudents,
                availableStudentsCount,
                students
            });
        }


        // =====================================================
        // Get My Profile
        // - reads skills from StudentSkills tables (primary)
        // =====================================================
        [HttpGet("me/profile")]
        public async Task<IActionResult> GetMyProfile()
        {
            int studentId = int.Parse(User.FindFirst("id")!.Value);

            var student = await _db.Students
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.Id == studentId);

            if (student == null)
                return NotFound(new { message = "الطالب غير موجود" });

            var profile = await _db.ProfileDetails
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.StudentId == studentId);

            // ✅ skills from tables
            var skills = await _db.StudentSkills
                .AsNoTracking()
                .Where(ss => ss.StudentId == studentId)
                .Select(ss => ss.Skill.Name)
                .Distinct()
                .ToListAsync();

            // fallback لو ما عنده جدول skills (قديم)
            if (skills.Count == 0 && !string.IsNullOrWhiteSpace(profile?.SkillsCsv))
            {
                skills = profile.SkillsCsv
                    .Split(',', StringSplitOptions.RemoveEmptyEntries)
                    .Select(x => x.Trim())
                    .Where(x => x.Length > 0)
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList();
            }

            return Ok(new
            {
                studentId = student.Id,
                fullName = student.FullName,
                email = student.Email,
                universityId = student.UniversityId, // ✅ FIX: رجّع الرقم الجامعي
                major = student.Major,
                bio = profile?.Bio,
                github = profile?.GitHubUrl,
                linkedin = profile?.LinkedInUrl,
                skills
            });
        }

        // =====================================================
        // Upsert My Profile
        // ✅ saves skills to tables (Skill + StudentSkill)
        // (and keeps SkillsCsv for backward compatibility)
        // =====================================================
        [HttpPut("me/profile")]
        public async Task<IActionResult> UpsertMyProfile([FromBody] ProgilDto dto)
        {
            int studentId = int.Parse(User.FindFirst("id")!.Value);

            bool ValidUrl(string? u) => string.IsNullOrWhiteSpace(u) || Uri.TryCreate(u.Trim(), UriKind.Absolute, out _);
            if (!ValidUrl(dto.GitHub) || !ValidUrl(dto.LinkedIn))
                return BadRequest(new { message = "الرابط غير صالح" });

            var profile = await _db.ProfileDetails
                .FirstOrDefaultAsync(p => p.StudentId == studentId);

            if (profile == null)
            {
                profile = new ProfileDetails { StudentId = studentId };
                _db.ProfileDetails.Add(profile);
            }

            profile.Bio = dto.Bio?.Trim();
            profile.GitHubUrl = dto.GitHub?.Trim();
            profile.LinkedInUrl = dto.LinkedIn?.Trim();

            var skills = (dto.Skills ?? new List<string>())
                .Select(s => (s ?? "").Trim())
                .Where(s => s.Length > 0)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            // keep legacy csv (optional)
            profile.SkillsCsv = string.Join(",", skills);

            // ✅ sync skills tables
            // 1) remove old relations
            var oldLinks = await _db.StudentSkills
                .Where(ss => ss.StudentId == studentId)
                .ToListAsync();
            _db.StudentSkills.RemoveRange(oldLinks);

            // 2) ensure skills exist + add new relations
            foreach (var skillName in skills)
            {
                var existingSkill = await _db.Skills
                    .FirstOrDefaultAsync(s => s.Name.ToLower() == skillName.ToLower());

                if (existingSkill == null)
                {
                    existingSkill = new Skill { Name = skillName };
                    _db.Skills.Add(existingSkill);
                    await _db.SaveChangesAsync(); // عشان ياخذ Id
                }

                _db.StudentSkills.Add(new StudentSkill
                {
                    StudentId = studentId,
                    SkillId = existingSkill.Id
                });
            }

            await _db.SaveChangesAsync();
            return Ok(new { message = "تم حفظ الملف الشخصي" });
        }

        // =====================================================
        // Get Student Profile By Id (for teammates modal)
        // =====================================================
        [HttpGet("{id:int}/profile")]
        public async Task<IActionResult> GetStudentProfileById([FromRoute] int id)
        {
            int currentStudentId = int.Parse(User.FindFirst("id")!.Value);

            // (اختياري) تمنع يجيب بروفايله هون
            // if (id == currentStudentId) return await GetMyProfile();

            var student = await _db.Students
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.Id == id);

            if (student == null)
                return NotFound(new { message = "الطالب غير موجود" });

            var profile = await _db.ProfileDetails
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.StudentId == id);

            var skills = await _db.StudentSkills
                .AsNoTracking()
                .Where(ss => ss.StudentId == id)
                .Select(ss => ss.Skill.Name)
                .Distinct()
                .ToListAsync();

            // fallback (لو بيانات قديمة)
            if (skills.Count == 0 && !string.IsNullOrWhiteSpace(profile?.SkillsCsv))
            {
                skills = profile.SkillsCsv
                    .Split(',', StringSplitOptions.RemoveEmptyEntries)
                    .Select(x => x.Trim())
                    .Where(x => x.Length > 0)
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList();
            }

            return Ok(new
            {
                studentId = student.Id,
                fullName = student.FullName,
                email = student.Email,
                universityId = student.UniversityId,
                major = student.Major,
                bio = profile?.Bio,
                github = profile?.GitHubUrl,
                linkedin = profile?.LinkedInUrl,
                skills
            });
        }

        // =====================================================
        // Helpers: check if student can access a project
        // =====================================================
        private async Task<bool> CanAccessProject(int projectId, int studentId)
        {
            // Owner OR Accepted member
            var isOwner = await _db.Projects.AnyAsync(p =>
                p.Id == projectId && p.OwnerStudentId == studentId);

            if (isOwner) return true;

            var isMember = await _db.ProjectMembers.AnyAsync(pm =>
                pm.ProjectId == projectId &&
                pm.StudentId == studentId &&
                pm.Status == "Accepted");

            return isMember;
        }

        // =====================================================
        // Get Weekly Reports for my project (Student)
        // GET: /api/students/projects/{projectId}/weekly-reports
        // =====================================================
        [HttpGet("projects/{projectId:int}/weekly-reports")]
        public async Task<IActionResult> GetWeeklyReportsForStudent(int projectId)
        {
            int studentId = int.Parse(User.FindFirst("id")!.Value);

            if (!await CanAccessProject(projectId, studentId))
                return Forbid();

            var reports = await _db.WeeklyReports
                .AsNoTracking()
                .Where(r => r.ProjectId == projectId)
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

        // =====================================================
        // Get Supervisor Comments for my project (Student)
        // GET: /api/students/projects/{projectId}/supervisor-comments
        // =====================================================
        [HttpGet("projects/{projectId:int}/supervisor-comments")]
        public async Task<IActionResult> GetSupervisorCommentsForStudent(int projectId)
        {
            int studentId = int.Parse(User.FindFirst("id")!.Value);

            if (!await CanAccessProject(projectId, studentId))
                return Forbid();

            var comments = await _db.SupervisorComments
                .AsNoTracking()
                .Where(c => c.ProjectId == projectId)
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
    }
}
