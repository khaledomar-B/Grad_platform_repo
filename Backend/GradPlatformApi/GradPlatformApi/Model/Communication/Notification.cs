using GradPlatformApi.Model.Users;

namespace GradPlatformApi.Model.Communication
{
    public class Notification
    {
        public int Id { get; set; }

        // المستلم
        public int ReceiverId { get; set; }
        public Student Receiver { get; set; }

        // مين سبّب الإشعار (طالب / مشرف)
        public int? ActorId { get; set; }
        public Student? Actor { get; set; }

        // نوع الإشعار
        public NotificationType Type { get; set; }

        // محتوى الإشعار
        public string Title { get; set; }
        public string Message { get; set; }

        // JSON: projectId, milestoneId, url...
        public string Data { get; set; }

        // حالة القراءة
        public bool IsRead { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? ReadAt { get; set; }

        // لمنع التكرار (cron job)
        public string? DedupeKey { get; set; }
    }
}
