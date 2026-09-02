namespace GradPlatformApi.Model.DTOs
{
    public class CreateMilestoneDto
    {
        public int Order { get; set; } = 1;
        public string Name { get; set; } = "";
        public string? Description { get; set; }
        public DateTime? Deadline { get; set; } // راح نخزنها في EndAt
        public string? Status { get; set; } // optional: locked/active/completed
    }
}
