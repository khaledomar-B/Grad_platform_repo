using GradPlatformApi.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace GradPlatformApi.Controllers
{
    [ApiController]
    [Route("api/users")]
    [Authorize]
    public class UsersController : ControllerBase
    {
        private readonly AppDbContext _db;

        public UsersController(AppDbContext db)
        {
            _db = db;
        }

        // هذا الكود يبقى كما هو للـ Student
        [HttpGet("me")]
        public async Task<IActionResult> GetMe()
        {
            int userId = int.Parse(User.FindFirst("id")!.Value);

            var student = await _db.Students
                .Where(s => s.Id == userId)
                .Select(s => new
                {
                    id = s.Id,
                    fullName = s.FullName,
                    email = s.Email,
                    role = "Student"
                })
                .FirstOrDefaultAsync();

            if (student == null)
                return NotFound();

            return Ok(student);
        }

        // هذا الكود الجديد للتحقق من المشرف
        [HttpGet("me/supervisor")]
        public async Task<IActionResult> GetSupervisor()
        {
            int userId = int.Parse(User.FindFirst("id")!.Value);

            // تحقق إذا كان المستخدم مشرفًا
            var supervisor = await _db.supervisors
                .Where(s => s.Id == userId)
                .Select(s => new
                {
                    id = s.Id,
                    fullName = $"{s.FirstName} {s.LastName}",  // دمج firstName و lastName لعمل fullName
                    email = s.Email,
                    role = "Supervisor"
                })
                .FirstOrDefaultAsync();

            if (supervisor == null)
                return Unauthorized(new { message = "ليس لديك صلاحية كمشرف" });

            return Ok(supervisor); // إرجاع بيانات المشرف
        }
    }
}
