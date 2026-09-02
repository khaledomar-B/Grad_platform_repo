using GradPlatformApi.Model.DTOs;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;

namespace GradPlatformApi.Services
{
    public class AiService
    {
        private readonly HttpClient _client;
        private readonly IConfiguration _config;

        // خيارات موحدة للـ JSON (تفيد بالـ Deserialize خصوصًا)
        private static readonly JsonSerializerOptions _jsonOptions = new()
        {
            PropertyNameCaseInsensitive = true
        };

        public AiService(HttpClient client, IConfiguration config)
        {
            _client = client;
            _config = config;
        }

        // =========================
        // 1) Generate Ideas
        // =========================
        public async Task<object> GenerateIdeas(GenerateIdeasRequest req)
        {
            string aiUrl = (_config["AiIdeasUrl"] ?? "").Trim().TrimEnd('/') + "/generate-ideas";

            using var response = await _client.PostAsJsonAsync(aiUrl, req);
            var raw = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
                throw new Exception("AI Error: " + raw);

            return JsonSerializer.Deserialize<object>(raw, _jsonOptions)!;
        }

        // =========================
        // 2) Similarity Check
        // =========================
        public async Task<SimilarityResponseDto> CheckSimilarity(SimilarityRequestDto req)
        {
            Console.WriteLine($"تم استلام البيانات: {req.Title} - {req.Summary}");

            string aiUrl = (_config["AiSimilarityUrl"] ?? "").Trim().TrimEnd('/') + "/check-similarity";

            using var response = await _client.PostAsJsonAsync(aiUrl, req);
            var raw = await response.Content.ReadAsStringAsync();

            Console.WriteLine("FASTAPI RAW RESPONSE:");
            Console.WriteLine(raw);

            if (!response.IsSuccessStatusCode)
                throw new Exception("Similarity AI Error: " + raw);

            var obj = JsonSerializer.Deserialize<SimilarityResponseDto>(raw, _jsonOptions);
            if (obj == null) throw new Exception("Similarity AI returned empty body.");

            return obj;
        }

        // =========================
        // 3) AI Phases Report (FastAPI first, then fallback)
        // =========================
        public async Task<string> GeneratePhasesReportMarkdown(AiPhasesReportRequestDto req, string language = "ar")
        {
            if (req?.Milestones == null || req.Milestones.Count == 0)
                return "";

            var milestones = req.Milestones
                .Where(m => !string.IsNullOrWhiteSpace(m.StudentText))
                .OrderBy(m => m.Order)
                .ToList();

            if (milestones.Count == 0)
                return "";

            var baseUrl = (_config["AiPhasesReportUrl"] ?? "").Trim().TrimEnd('/');
            if (!string.IsNullOrWhiteSpace(baseUrl))
            {
                var url = $"{baseUrl}/ai/report/generate";

                var payload = new
                {
                    projectId = req.ProjectId,
                    language = language,
                    steps = milestones.Select(m => new
                    {
                        stepNumber = m.Order,
                        title = m.Name ?? "",
                        content = m.StudentText ?? ""
                    }).ToList()
                };

                using var response = await _client.PostAsJsonAsync(url, payload);
                var raw = await response.Content.ReadAsStringAsync();

                if (response.IsSuccessStatusCode)
                {
                    var ct = response.Content.Headers.ContentType?.MediaType ?? "";
                    if (!ct.Contains("application/json", StringComparison.OrdinalIgnoreCase))
                        return raw;

                    try
                    {
                        using var doc = JsonDocument.Parse(raw);
                        var root = doc.RootElement;

                        if (root.TryGetProperty("markdown", out var md) && md.ValueKind == JsonValueKind.String)
                            return md.GetString() ?? "";

                        if (root.TryGetProperty("reportMarkdown", out var a) && a.ValueKind == JsonValueKind.String)
                            return a.GetString() ?? "";

                        if (root.TryGetProperty("report_markdown", out var b) && b.ValueKind == JsonValueKind.String)
                            return b.GetString() ?? "";

                        return raw;
                    }
                    catch
                    {
                        return raw;
                    }
                }

                Console.WriteLine("AI Phases Report FASTAPI Error:");
                Console.WriteLine(raw);
            }

            return GenerateMarkdownLocally(milestones, req.ProjectId, req.ProjectTitle);
        }

        private static string GenerateMarkdownLocally(
            List<AiPhasesReportMilestoneDto> milestones,
            int projectId,
            string? projectTitle)
        {
            var md = new StringBuilder();
            md.AppendLine("# AI Phases Report");
            md.AppendLine();
            md.AppendLine($"**Project ID:** {projectId}");
            if (!string.IsNullOrWhiteSpace(projectTitle))
                md.AppendLine($"**Project Title:** {projectTitle}");
            md.AppendLine($"**Generated At:** {DateTime.UtcNow:yyyy-MM-dd HH:mm} UTC");
            md.AppendLine();
            md.AppendLine("---");
            md.AppendLine();

            foreach (var m in milestones)
            {
                var title = string.IsNullOrWhiteSpace(m.Name) ? $"Phase {m.Order}" : m.Name.Trim();
                var content = (m.StudentText ?? "").Trim();

                md.AppendLine($"## Phase {m.Order}: {title}");
                md.AppendLine();
                md.AppendLine(content);
                md.AppendLine();
                md.AppendLine("---");
                md.AppendLine();
            }

            return md.ToString();
        }

        // =========================
        // Predict Category
        // =========================
        public async Task<AiCategoryResponseDto> PredictCategory(AiCategoryRequestDto req)
        {
            var baseUrl = (_config["AiCategoryUrl"] ?? "").Trim().TrimEnd('/');
            if (string.IsNullOrWhiteSpace(baseUrl))
                throw new Exception("AiCategoryUrl is missing in appsettings.json");

            var url = $"{baseUrl}/predict-category";

            var payload = new
            {
                title = req.Title ?? "",
                description = req.Description ?? "",
                keywords = req.Keywords ?? ""
            };

            using var response = await _client.PostAsJsonAsync(url, payload);
            var raw = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
                throw new Exception("Category AI Error: " + raw);

            var obj = JsonSerializer.Deserialize<AiCategoryResponseDto>(raw, _jsonOptions);
            if (obj == null) throw new Exception("Category AI returned empty body.");

            return obj;
        }

        // =========================
        // Phase 1 Checklist Run
        // =========================
        public async Task<Phase1ChecklistRunResponseDto> RunPhase1Checklist(Phase1ChecklistInputDto req)
        {
            var baseUrl = (_config["AiPhase1Url"] ?? "").Trim().TrimEnd('/');
            if (string.IsNullOrWhiteSpace(baseUrl))
                throw new Exception("AiPhase1Url is missing in appsettings.json");

            var url = $"{baseUrl}/phase1/checklist/run";

            // ✅ اطبع الرابط قبل الإرسال
            Console.WriteLine("AiPhase1Url = " + baseUrl);
            Console.WriteLine("Calling FastAPI URL = " + url);

            using var response = await _client.PostAsJsonAsync(url, req);
            var raw = await response.Content.ReadAsStringAsync();

            // ✅ اطبع الرد الخام من FastAPI
            Console.WriteLine("FASTAPI RAW RESPONSE:");
            Console.WriteLine(raw);

            if (!response.IsSuccessStatusCode)
                throw new Exception("Phase1 Checklist AI Error: " + raw);

            var obj = JsonSerializer.Deserialize<Phase1ChecklistRunResponseDto>(raw, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });

            if (obj == null)
                throw new Exception("Phase1 Checklist AI returned empty body. Raw: " + raw);

            return obj;
        }


        // =========================
        // Phase 1 Suggest
        // =========================
        public async Task<Phase1AiSuggestResponseDto> Phase1Suggest(Phase1AiSuggestRequestDto req)
        {
            var baseUrl = (_config["AiPhase1Url"] ?? "").Trim().TrimEnd('/');
            if (string.IsNullOrWhiteSpace(baseUrl))
                throw new Exception("AiPhase1Url is missing in appsettings.json");

            var url = $"{baseUrl}/phase1/ai/suggest";

            using var response = await _client.PostAsJsonAsync(url, req);
            var raw = await response.Content.ReadAsStringAsync();
            Console.WriteLine("FASTAPI RAW RESPONSE:");
            Console.WriteLine(raw);


            if (!response.IsSuccessStatusCode)
                throw new Exception("Phase1 Suggest AI Error: " + raw);

            var obj = JsonSerializer.Deserialize<Phase1AiSuggestResponseDto>(raw, _jsonOptions);
            if (obj == null) throw new Exception("Phase1 Suggest AI returned empty body. Raw: " + raw);

            return obj;
        }

        // =========================
        // Get Phase 1 Criteria
        // =========================
        public async Task<object> GetPhase1Criteria()
        {
            var baseUrl = (_config["AiPhase1Url"] ?? "").Trim().TrimEnd('/');
            if (string.IsNullOrWhiteSpace(baseUrl))
                throw new Exception("AiPhase1Url is missing in appsettings.json");

            var url = $"{baseUrl}/phase1/criteria";

            using var response = await _client.GetAsync(url);
            var raw = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
                throw new Exception("Phase1 Criteria AI Error: " + raw);

            return JsonSerializer.Deserialize<object>(raw, _jsonOptions)!;
        }
    }
}
