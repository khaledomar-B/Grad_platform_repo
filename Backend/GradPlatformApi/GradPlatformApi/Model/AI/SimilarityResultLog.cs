using GradPlatformApi.Model.Projects;
using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace GradPlatformApi.Model.AI
{
    public class SimilarityResultLog
    {
        [Key]
        public int Id { get; set; }

        // الربط مع التسليم
        [Required]
        public int SubmissionId { get; set; }

        // نسبة التشابه
        [Required]
        public double SimilarityPercentage { get; set; }

        // تقرير مختصر (مبدئي)
        public string Report { get; set; }

        public DateTime CheckedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey("SubmissionId")]
        public Submission Submission { get; set; }
    }
}
