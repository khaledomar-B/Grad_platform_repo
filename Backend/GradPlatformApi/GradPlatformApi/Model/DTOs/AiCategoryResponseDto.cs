using System.Text.Json.Serialization;

namespace GradPlatformApi.Model.DTOs
{
    public class AiCategoryResponseDto
    {
        [JsonPropertyName("label")]
        public string Label { get; set; } = "";

        [JsonPropertyName("confidence_level")]
        public string ConfidenceLevel { get; set; } = "";
    }
}
