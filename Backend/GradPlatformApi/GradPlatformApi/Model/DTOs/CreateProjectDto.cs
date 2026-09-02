public class CreateProjectDto
{
    public string Title { get; set; } = null!;
    public string Description { get; set; } = null!;
    public string ProjectType { get; set; } = "Individual";
    public string? Category { get; set; }

    public int SupervisorId { get; set; }
}
