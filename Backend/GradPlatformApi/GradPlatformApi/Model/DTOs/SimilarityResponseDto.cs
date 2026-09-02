using System.Text.Json.Serialization;

namespace GradPlatformApi.Model.DTOs
{
    public class SimilarityResponseDto
    {
        [JsonPropertyName("similarity_percentage")]
        public double SimilarityPercentage { get; set; }

        [JsonPropertyName("is_possible_duplicate")]
        public bool IsPossibleDuplicate { get; set; }

        [JsonPropertyName("matched_project_id")]
        public int? MatchedProjectId { get; set; }

        [JsonPropertyName("matched_project_title")]
        public string? MatchedProjectTitle { get; set; }

        [JsonPropertyName("matched_project_summary")]
        public string? MatchedProjectSummary { get; set; }
    }
}
