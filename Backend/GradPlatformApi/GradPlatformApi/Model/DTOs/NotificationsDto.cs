namespace GradPlatformApi.DTOs
{
    public class NotificationDto
    {
        public int Id { get; set; }
        public string UiType { get; set; }   // type-join / type-comment / ...
        public string Title { get; set; }
        public string Message { get; set; }
        public bool IsRead { get; set; }
        public DateTime CreatedAt { get; set; }
        public string TimeLabel { get; set; } // "منذ ساعتين"
        public string Data { get; set; }      // JSON string
    }
}

