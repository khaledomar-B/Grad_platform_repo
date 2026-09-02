using GradPlatformApi.Data;
using GradPlatformApi.Model.Communication;

namespace GradPlatformApi.Services
{
    public class NotificationService
    {
        private readonly AppDbContext _db;

        public NotificationService(AppDbContext db)
        {
            _db = db;
        }

        public async Task CreateAsync(
            int receiverId,
            int? actorId,
            NotificationType type,
            string title,
            string message,
            object? data = null,
            string? dedupeKey = null)
        {
            if (!string.IsNullOrWhiteSpace(dedupeKey))
            {
                var exists = _db.Notifications.Any(n => n.DedupeKey == dedupeKey);
                if (exists) return;
            }

            var notification = new Notification
            {
                ReceiverId = receiverId,
                ActorId = actorId,
                Type = type,
                Title = title,
                Message = message,
                Data = data == null ? "{}" : System.Text.Json.JsonSerializer.Serialize(data),
                DedupeKey = dedupeKey,
                IsRead = false,
                CreatedAt = DateTime.UtcNow
            };

            _db.Notifications.Add(notification);
            await _db.SaveChangesAsync();
        }
    }
}
