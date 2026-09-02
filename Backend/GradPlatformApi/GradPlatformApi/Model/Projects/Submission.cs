using GradPlatformApi.Model.Users;

namespace GradPlatformApi.Model.Projects
{
    public class Submission
    {
        public int Id { get; set; }

        public int ProjectId { get; set; }
        public Project Project { get; set; } = null!;

        public int MilestoneId { get; set; }
        public Milestone Milestone { get; set; } = null!;

        // الطالب الذي رفع التسليم
        public int StudentId { get; set; }
        public Student Student { get; set; } = null!;

        // حالة التسليم
        public string Status { get; set; } = "Submitted";
        // Submitted / Approved / Rejected

        public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
        public string? SupervisorComment { get; set; }   
        public DateTime? ReviewedAt { get; set; }       
        public int? SupervisorId { get; set; }

        // ✅ مجموعة ملفات التسليم
        public ICollection<SubmissionFile> Files { get; set; } = new List<SubmissionFile>();
    }
}
