using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace GradPlatformApi.Model.Projects
{
    public class ProjectMessage
    {
        public int Id { get; set; }

        [ForeignKey(nameof(Project))]
        public int ProjectId { get; set; }
        public Project Project { get; set; } = null!;

        // Sender من الـ JWT claim "id" عندك
        public int SenderId { get; set; }

        // "student" أو "Supervisor"
        [MaxLength(20)]
        public string SenderRole { get; set; } = null!;

        [Required]
        public string Content { get; set; } = null!;

        public DateTime SentAt { get; set; } = DateTime.UtcNow;
    }
}
