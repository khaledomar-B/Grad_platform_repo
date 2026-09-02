using GradPlatformApi.Model.Enum;
namespace GradPlatformApi.Model.Projects
    
{
    public class ProjectTechnology
    {
        public int Id { get; set; }

        public int ProjectId { get; set; }
        public Project Project { get; set; } = null!;

        public TechnologyCategory Category { get; set; }  // Frontend/Backend/...
        public string Name { get; set; } = "";            // React, Node.js, SQL...
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

}
