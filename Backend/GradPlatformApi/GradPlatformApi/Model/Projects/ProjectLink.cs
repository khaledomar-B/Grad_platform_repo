using GradPlatformApi.Model.Enum;
namespace GradPlatformApi.Model.Projects
{
    public class ProjectLink
    {
        public int Id { get; set; }

        public int ProjectId { get; set; }
        public Project Project { get; set; } = null!;

        public ProjectLinkType Type { get; set; }  // Demo/GitHub/Docs/Figma
        public string Url { get; set; } = "";

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
