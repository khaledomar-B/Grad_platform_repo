namespace GradPlatformApi.Model.Communication
{
    public class SupervisorComment
    {
        public int Id { get; set; }

        public int ProjectId { get; set; }
        public Project Project { get; set; } = null!;

        public int SupervisorId { get; set; }

        public string Title { get; set; } = "";
        public string Content { get; set; } = "";

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
