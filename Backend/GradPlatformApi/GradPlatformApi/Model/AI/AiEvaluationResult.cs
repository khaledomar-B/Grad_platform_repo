using GradPlatformApi.Model.Projects;
using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace GradPlatformApi.Model.AI
{
    public class AiEvaluationResult
    {
        [Key]
        public int Id { get; set; }

        // الربط مع التسليم
        [Required]
        public int SubmissionId { get; set; }

        // التقييم الرقمي
        public double Score { get; set; }

        // ملاحظات عامة من الـ AI
        public string Comments { get; set; }

        public DateTime EvaluatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey("SubmissionId")]
        public Submission Submission { get; set; }
    }
}
