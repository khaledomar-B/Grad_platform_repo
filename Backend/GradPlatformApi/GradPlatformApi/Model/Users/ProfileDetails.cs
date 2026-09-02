using System.ComponentModel.DataAnnotations;

namespace GradPlatformApi.Model.Users
{
    public class ProfileDetails
    {
        [Key]
        public int Id { get; set; }

        // FK
        [Required]
        public int StudentId { get; set; }

        // Navigation (اختياري لكن مفيد)
        public Student Student { get; set; }

        // ===== Editable fields =====
        public string? Bio { get; set; }

        [MaxLength(500)]
        public string? GitHubUrl { get; set; }

        [MaxLength(500)]
        public string? LinkedInUrl { get; set; }

        // نخزنها CSV: "C#,SQL,HTML"
        public string? SkillsCsv { get; set; }
    }
}
