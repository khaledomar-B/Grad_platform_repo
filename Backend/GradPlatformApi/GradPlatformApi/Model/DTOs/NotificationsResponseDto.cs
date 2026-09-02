using GradPlatformApi.DTOs;

namespace GradPlatformApi.Model.DTOs
{
    public class NotificationsResponseDto
    {
        public int UnreadCount { get; set; }
        public List<NotificationDto> Items { get; set; } = new();
    }
}
