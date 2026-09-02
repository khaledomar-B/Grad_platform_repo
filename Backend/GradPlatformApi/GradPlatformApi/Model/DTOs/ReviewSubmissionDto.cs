namespace GradPlatformApi.Model.DTOs
{
    public class ReviewSubmissionDto
    {
        public string? SupervisorComment { get; set; }
        public string Status { get; set; } = "Approved";
        // Approved / Rejected (أو خليه Approved فقط حسب نظامك)
    }
}
