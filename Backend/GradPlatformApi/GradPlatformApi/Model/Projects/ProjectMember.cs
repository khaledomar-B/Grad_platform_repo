using System.ComponentModel.DataAnnotations.Schema;
using GradPlatformApi.Model.Users;

namespace GradPlatformApi.Model.Projects
{
    public class ProjectMember
    {
        public int Id { get; set; }

        public int ProjectId { get; set; }
        public Project Project { get; set; } = null!;

        [ForeignKey(nameof(Student))]
        public int StudentId { get; set; }
        public Student Student { get; set; } = null!;

        public string RoleINProject { get; set; } = string.Empty;
        public string Status { get; set; } = "Accepted";
        public bool IsOwner { get; set; } = false;
        public DateTime JoinedAt { get; set; } = DateTime.UtcNow;
    }
}
