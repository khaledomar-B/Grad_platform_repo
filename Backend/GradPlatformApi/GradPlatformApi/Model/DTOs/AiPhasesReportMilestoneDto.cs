namespace GradPlatformApi.Model.DTOs
{
    public class AiPhasesReportMilestoneDto
    {
        public int MilestoneId { get; set; }
        public int Order { get; set; }
        public string Name { get; set; } = "";
        public string StudentText { get; set; } = "";
    }
}
