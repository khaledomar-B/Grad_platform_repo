namespace GradPlatformApi.Model.Projects
{
    public class Progress
    {
        public int Id { get; set; }
        public int MilestoneId { get; set; }

        public Milestone Milestone { get; set; } = null!;
        public double percentage { get; set; }
        public DateTime UpdateAt { get; set; } = DateTime.UtcNow;
        public string comments { get; set; }
    }
}
