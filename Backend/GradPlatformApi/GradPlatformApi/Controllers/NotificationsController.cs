using GradPlatformApi.Data;
using GradPlatformApi.DTOs;
using GradPlatformApi.Helpers;
using GradPlatformApi.Model.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace GradPlatformApi.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class NotificationsController : ControllerBase
    {
        private readonly AppDbContext _db;

        public NotificationsController(AppDbContext db)
        {
            _db = db;
        }

        private int GetUserId()
        {
            // ✅ نفس الطريقة المستخدمة بباقي الكنترولرز عندك
            return int.Parse(User.FindFirst("id")!.Value);
        }

        [HttpGet]
        public async Task<ActionResult<NotificationsResponseDto>> Get([FromQuery] string filter = "all")
        {
            var userId = GetUserId();

            var query = _db.Notifications.AsNoTracking()
                .Where(n => n.ReceiverId == userId);

            if (filter.Equals("unread", StringComparison.OrdinalIgnoreCase))
                query = query.Where(n => !n.IsRead);

            var list = await query
                .OrderByDescending(n => n.CreatedAt)
                .Take(50)
                .ToListAsync();

            var unreadCount = await _db.Notifications.CountAsync(n => n.ReceiverId == userId && !n.IsRead);

            var items = list.Select(n => new NotificationDto
            {
                Id = n.Id,
                UiType = NotificationUiMapper.ToUiType(n.Type),
                Title = n.Title,
                Message = n.Message,
                IsRead = n.IsRead,
                CreatedAt = n.CreatedAt,
                TimeLabel = ToArabicRelativeTime(n.CreatedAt),
                Data = n.Data
            }).ToList();

            return Ok(new NotificationsResponseDto
            {
                UnreadCount = unreadCount,
                Items = items
            });
        }

        [HttpGet("unread-count")]
        public async Task<IActionResult> UnreadCount()
        {
            var userId = GetUserId();
            var count = await _db.Notifications.CountAsync(n => n.ReceiverId == userId && !n.IsRead);
            return Ok(new { unreadCount = count });
        }

        [HttpPatch("{id}/read")]
        public async Task<IActionResult> MarkRead(int id)
        {
            var userId = GetUserId();

            var n = await _db.Notifications
                .FirstOrDefaultAsync(x => x.Id == id && x.ReceiverId == userId);

            if (n == null) return NotFound();

            if (!n.IsRead)
            {
                n.IsRead = true;
                n.ReadAt = DateTime.UtcNow;
                await _db.SaveChangesAsync();
            }

            return NoContent();
        }

        [HttpPatch("read-all")]
        public async Task<IActionResult> MarkAllRead()
        {
            var userId = GetUserId();

            var list = await _db.Notifications
                .Where(n => n.ReceiverId == userId && !n.IsRead)
                .ToListAsync();

            if (list.Count == 0) return NoContent();

            var now = DateTime.UtcNow;
            foreach (var n in list)
            {
                n.IsRead = true;
                n.ReadAt = now;
            }

            await _db.SaveChangesAsync();
            return NoContent();
        }

        private static string ToArabicRelativeTime(DateTime createdAtUtc)
        {
            var diff = DateTime.UtcNow - createdAtUtc;

            if (diff.TotalMinutes < 1) return "الآن";
            if (diff.TotalMinutes < 60) return $"منذ {(int)diff.TotalMinutes} دقيقة";
            if (diff.TotalHours < 24) return $"منذ {(int)diff.TotalHours} ساعة";
            if (diff.TotalDays < 2) return "أمس";
            return $"منذ {(int)diff.TotalDays} أيام";
        }
    }
}
