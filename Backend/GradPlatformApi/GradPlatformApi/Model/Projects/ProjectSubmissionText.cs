namespace GradPlatformApi.Model.Projects
{
    public class ProjectSubmissionText
    {
        public int Id { get; set; }

        public int ProjectId { get; set; }

        // رقم المخرج/الخطوة: 1..5 (لمقترح المرحلة الأولى)
        public int StepNumber { get; set; }

        public string Title { get; set; } = "";
        public string Content { get; set; } = "";

        public int StudentId { get; set; }

        public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
    }
}