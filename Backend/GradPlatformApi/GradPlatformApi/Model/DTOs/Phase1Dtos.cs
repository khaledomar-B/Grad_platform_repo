using System.Text.Json.Serialization;

namespace GradPlatformApi.Model.DTOs
{
    // =========================
    // Phase 1 Checklist Input
    // =========================
    public class Phase1ChecklistInputDto
    {
        [JsonPropertyName("project_id")]
        public int ProjectId { get; set; }

        [JsonPropertyName("title_and_desc")]
        public string TitleAndDesc { get; set; } = "";

        [JsonPropertyName("problem_and_solution")]
        public string ProblemAndSolution { get; set; } = "";

        [JsonPropertyName("objectives")]
        public string Objectives { get; set; } = "";

        [JsonPropertyName("tools")]
        public string Tools { get; set; } = "";

        [JsonPropertyName("timeline")]
        public string? Timeline { get; set; }
    }

    // =========================
    // Phase 1 Checklist Result Item
    // =========================
    public class Phase1ChecklistResultItemDto
    {
        [JsonPropertyName("criterion_id")]
        public int CriterionId { get; set; }

        [JsonPropertyName("status")]
        public string? Status { get; set; } = "";

        // ✅ FastAPI ممكن يرجّع null (حسب الخطأ اللي ظهر عندك)
        [JsonPropertyName("is_passed")]
        public bool? IsPassed { get; set; }

        [JsonPropertyName("score")]
        public double? Score { get; set; }

        // ✅ FastAPI يرجّع comment ممكن تكون null
        [JsonPropertyName("comment")]
        public string? Comment { get; set; }
    }

    // =========================
    // Phase 1 Checklist Run Response (matches FastAPI)
    // =========================
    public class Phase1ChecklistRunResponseDto
    {
        [JsonPropertyName("run_id")]
        public int RunId { get; set; }

        [JsonPropertyName("project_id")]
        public int ProjectId { get; set; }

        [JsonPropertyName("total_score")]
        public double TotalScore { get; set; }

        // ✅ FastAPI اسمها passed
        [JsonPropertyName("passed")]
        public bool Passed { get; set; }

        [JsonPropertyName("results")]
        public List<Phase1ChecklistResultItemDto> Results { get; set; } = new();
    }

    // =========================
    // Phase 1 AI Suggest Request
    // =========================
    public class Phase1AiSuggestRequestDto
    {
        [JsonPropertyName("criterion_id")]
        public int CriterionId { get; set; }

        [JsonPropertyName("criterion_title")]
        public string CriterionTitle { get; set; } = "";

        [JsonPropertyName("criterion_description")]
        public string CriterionDescription { get; set; } = "";

        [JsonPropertyName("student_text")]
        public string StudentText { get; set; } = "";

        [JsonPropertyName("rule_comment")]
        public string? RuleComment { get; set; }

        [JsonPropertyName("language")]
        public string Language { get; set; } = "ar";

        [JsonPropertyName("type")]
        public string Type { get; set; } = "general";
    }

    // =========================
    // Phase 1 AI Suggest Response
    // =========================
    public class Phase1AiSuggestResponseDto
    {
        [JsonPropertyName("criterion_id")]
        public int CriterionId { get; set; }

        [JsonPropertyName("original_text")]
        public string OriginalText { get; set; } = "";

        [JsonPropertyName("explanation")]
        public string Explanation { get; set; } = "";

        [JsonPropertyName("suggested_text")]
        public string SuggestedText { get; set; } = "";

        [JsonPropertyName("tips")]
        public List<string> Tips { get; set; } = new();
    }
}
