using GradPlatformApi.Model.Enum;
using GradPlatformApi.Model.Projects;

public class Milestone
{
    public int Id { get; set; }

    public string Name { get; set; } = null!;
    public string Description { get; set; } = null!;
    public DateTime DueDate { get; set; } // خليها (ممكن تعتبرها EndAt)

    public DateTime? StartAt { get; set; }   // ✅ وقت فتح التسليم
    public DateTime? EndAt { get; set; }     // ✅ وقت إغلاق التسليم

    public int Order { get; set; }
    public string Status { get; set; } = "Locked";
    // (بإمكانك لاحقًا تخلي Status محسوبة من الوقت، بس خليها الآن)
    public ProjectDocumentSection DocumentSection { get; set; } = ProjectDocumentSection.Final;


    public int ProjectId { get; set; }
    public Project Project { get; set; } = null!;

    public ICollection<Progress> ProgressEntries { get; set; } = new List<Progress>();
    public ICollection<Submission> Submissions { get; set; } = new List<Submission>();
}
