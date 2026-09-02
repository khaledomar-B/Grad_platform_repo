namespace GradPlatformApi.Model.DTOs
{
    public class AiPhasesReportRequestDto
    {
        public int ProjectId { get; set; }
        public string ProjectTitle { get; set; } = "";
        public List<AiPhasesReportMilestoneDto> Milestones { get; set; } = new();
    }
}
