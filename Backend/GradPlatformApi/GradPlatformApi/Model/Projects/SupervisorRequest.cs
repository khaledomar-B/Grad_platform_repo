using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using GradPlatformApi.Model.Users;

namespace GradPlatformApi.Model.Projects
{
    public class SupervisorRequest
    {
        public int Id { get; set; }

        [ForeignKey(nameof(Project))]
        public int ProjectId { get; set; }
        public Project Project { get; set; } = null!;

        [ForeignKey(nameof(Supervisor))]
        public int SupervisorId { get; set; }
        public Supervisor Supervisor { get; set; } = null!;

        [MaxLength(20)]
        public string Status { get; set; } = "Pending"; // Pending / Accepted / Rejected

        [MaxLength(500)]
        public string? Note { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? RespondedAt { get; set; }
    }
}
