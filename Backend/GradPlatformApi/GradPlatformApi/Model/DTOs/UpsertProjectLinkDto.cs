using GradPlatformApi.Model.Enum;

namespace GradPlatformApi.Model.DTOs
{
    public class UpsertProjectLinkDto
    {
        public ProjectLinkType Type { get; set; }
        public string Url { get; set; } = "";
    }

}
