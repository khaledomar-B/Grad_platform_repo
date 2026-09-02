using GradPlatformApi.Model.Users;
using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace GradPlatformApi.Model.AI
{
    public class AiGeneratedIdea
    {
        [Key]
        public int Id { get; set; }

        // ربط الفكرة بالطالب
        [Required]
        public int StudentId { get; set; }

        // عنوان الفكرة
        [Required]
        [MaxLength(150)]
        public string Title { get; set; }

        // وصف الفكرة
        [Required]
        public string Description { get; set; }

        // مستوى الصعوبة (Easy / Medium / Hard)
        [Required]
        [MaxLength(20)]
        public string Difficulty { get; set; }

        // الأدوات المقترحة (مخزنة كنص JSON أو CSV)
        [Required]
        public string RecommendedTools { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation Property
        [ForeignKey("StudentId")]
        public Student Student { get; set; }
    }
}
