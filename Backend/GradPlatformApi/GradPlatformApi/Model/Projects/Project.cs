using GradPlatformApi.Model.Projects;
using GradPlatformApi.Model.Users;

public class Project
{
    public int Id { get; set; }

    public string Title { get; set; } = null!;
    public string Description { get; set; } = null!;

    public string? Category { get; set; }   // AI / Web / Mobile / IoT / Data Science


    public string Status { get; set; } = "Pending";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public int? OwnerStudentId { get; set; }
    public Student? OwnerStudent { get; set; }   // اختياري (Navigation)


    public int? SupervisorId { get; set; }
    public Supervisor? Supervisor { get; set; }

    public string ProjectType { get; set; } = "Individual";

    public ICollection<Milestone> Milestones { get; set; } = new List<Milestone>();
    public ICollection<ProjectMember> ProjectMembers { get; set; } = new List<ProjectMember>();
    public ICollection<Submission> Submissions { get; set; } = new List<Submission>();
}
