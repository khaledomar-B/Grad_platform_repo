namespace GradPlatformApi.Model.Projects
{
    public class SubmissionFile
    {
        public int Id { get; set; }

        public int SubmissionId { get; set; }
        public Submission Submission { get; set; } = null!;

        public string FilePath { get; set; } = null!;
        public string OriginalFileName { get; set; } = null!;
        public long SizeBytes { get; set; }
    }
}
