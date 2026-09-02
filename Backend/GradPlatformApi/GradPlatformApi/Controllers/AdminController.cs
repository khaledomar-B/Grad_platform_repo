using GradPlatformApi.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace GradPlatformApi.Controllers
{
    [Route("api/admin")]
    [ApiController]
    public class AdminController : ControllerBase
    {
        private readonly AppDbContext _db;

        public AdminController(AppDbContext db)
        {
            _db = db;
        }

        // ================================================================
        // 1) عرض المشرفين غير الموافق عليهم
        // ================================================================
        [HttpGet("pending-supervisors")]
        public async Task<IActionResult> GetPendingSupervisors()
        {
            var pendingList = await _db.supervisors
                .Where(s => s.IsApproved == false)
                .Select(s => new
                {
                    s.Id,
                    s.FirstName,
                    s.LastName,
                    s.Email,
                    s.Department
                })
                .ToListAsync();

            return Ok(pendingList);
        }

        // ================================================================
        // 2) الموافقة على مشرف
        // ================================================================
        [HttpPut("approve-supervisor/{id}")]
        public async Task<IActionResult> ApproveSupervisor(int id)
        {
            var supervisor = await _db.supervisors.FirstOrDefaultAsync(s => s.Id == id);

            if (supervisor == null)
                return NotFound(new { message = "المشرف غير موجود." });

            if (supervisor.IsApproved)
                return BadRequest(new { message = "هذا المشرف موافَق عليه مسبقًا." });

            supervisor.IsApproved = true;
            await _db.SaveChangesAsync();

            return Ok(new { message = "تمت الموافقة على المشرف بنجاح." });
        }

        // ================================================================
// 3) إحصائيات عامة (Summary)
// ================================================================
[HttpGet("stats/summary")]
public async Task<IActionResult> GetStatsSummary()
{
    var totalProjects = await _db.Projects.CountAsync();

    var inProgress = await _db.Projects
        .CountAsync(p => p.Status == "InProgress" || p.Status == "Pending");

    var completed = await _db.Projects
        .CountAsync(p => p.Status == "Completed");

    var pendingReview = await _db.Projects
        .CountAsync(p => p.Status == "PendingReview");

    return Ok(new
    {
        totalProjects,
        inProgress,
        completed,
        pendingReview
    });
}

        // ================================================================
        // 4) عدد المشاريع حسب التخصص (Major)
        // ================================================================
        [HttpGet("stats/by-major")]
        public async Task<IActionResult> GetProjectsByMajor()
        {
            var data = await _db.Projects
                .Where(p => p.OwnerStudentId != null)
                .Join(
                    _db.Students,
                    p => p.OwnerStudentId,
                    s => s.Id,
                    (p, s) => new
                    {
                        Major = s.Major ?? "غير محدد"
                    }
                )
                .GroupBy(x => x.Major)
                .Select(g => new
                {
                    major = g.Key,
                    count = g.Count()
                })
                .OrderByDescending(x => x.count)
                .ToListAsync();

            return Ok(data);
        }


        // ================================================================
        // 5) عدد المشاريع حسب الحالة (Status)
        // ================================================================
        [HttpGet("stats/by-status")]
public async Task<IActionResult> GetProjectsByStatus()
{
    var data = await _db.Projects
        .GroupBy(p => p.Status)
        .Select(g => new
        {
            status = g.Key,
            count = g.Count()
        })
        .OrderByDescending(x => x.count)
        .ToListAsync();

    return Ok(data);
}

        // ================================================================
        // 6) عدد المشاريع حسب النوع (Individual / Team)
        // ================================================================
        [HttpGet("stats/by-category")]
        public async Task<IActionResult> GetProjectsByCategory()
        {
            var data = await _db.Projects
                .GroupBy(p => p.Category ?? "غير محدد")
                .Select(g => new
                {
                    category = g.Key,
                    count = g.Count()
                })
                .OrderByDescending(x => x.count)
                .ToListAsync();

            return Ok(data);
        }


    }
}
