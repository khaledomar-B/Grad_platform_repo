using GradPlatformApi.Model.Projects;
using GradPlatformApi.Model.Users;

namespace GradPlatformApi.Model.Communication
{
    public class TeamRequest
    {
        public int Id { get; set; }
        public int SenderId { get; set; }
        public Student Sender { get; set; } = null!;
        public int ReceiverId { get; set; }  
        public Student Receiver { get; set; } = null!;
        public int?ProjectId { get; set;  }
        public Project? Project { get; set; }
        public string Status { get; set; } = "Pending";
        public DateTime DateSent { get; set; } = DateTime.UtcNow;


    }
}
