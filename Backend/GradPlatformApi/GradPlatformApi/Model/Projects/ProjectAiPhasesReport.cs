using GradPlatformApi.Model.Projects;

namespace GradPlatformApi.Model.AI
{
    public class ProjectAiPhasesReport
    {
        public int Id { get; set; }

        public int ProjectId { get; set; }
        public Project Project { get; set; } = null!;

        public int GeneratedByStudentId { get; set; }  // اختياري
        public DateTime GeneratedAt { get; set; } = DateTime.UtcNow;

        public string Markdown { get; set; } = "";
    }
}
