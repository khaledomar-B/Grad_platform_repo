using GradPlatformApi.Model.Enum;

namespace GradPlatformApi.Model.DTOs
{
    public class AddTechnologyDto
    {
        public TechnologyCategory Category { get; set; }
        public string Name { get; set; } = "";
    }

}
