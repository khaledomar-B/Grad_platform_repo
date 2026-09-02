namespace GradPlatformApi.Model.DTOs
{
    public class SubmitMilestoneTextRequestDto
    {
        // outputs: { "0": "...", "1": "...", "2": "...", "3": "...", "4": "..." }
        public Dictionary<string, string> Outputs { get; set; } = new();
    }
}
