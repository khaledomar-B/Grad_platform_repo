namespace GradPlatformApi.Model.DTOs
{
    public class ProjectProgressDto
    {
        public int CompletedCount { get; set; }
        public int InProgressCount { get; set; }
        public int TotalMilestones { get; set; }
        public int Percentage { get; set; }

        public List<MilestoneStatusDto> Milestones { get; set; }
    }

    public class MilestoneStatusDto
    {
        public string Name { get; set; }
        public string Status { get; set; }
        public int Order { get; set; }
    }
}
