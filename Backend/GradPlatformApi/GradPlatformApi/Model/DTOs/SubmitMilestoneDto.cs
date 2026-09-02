using Microsoft.AspNetCore.Http;

namespace GradPlatformApi.Model.DTOs
{
    public class SubmitMilestoneDto
    {
        public List<IFormFile> Files { get; set; } = new();
        public string Mode { get; set; } = "append";
        public string? TextContent { get; set; }
    }
}
