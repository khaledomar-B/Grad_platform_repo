using GradPlatformApi.Model.Communication;
using GradPlatformApi.Model.Projects;
using GradPlatformApi.Model.Skills;
using GradPlatformApi.Model.Users;

namespace GradPlatformApi.Model.Users
{
    public class Student
    {
        public int Id { get; set; }
        public string UniversityId { get; set; } = null!;// الرقم الجامعي من الايميل
        public string FullName { get; set; } = null!;
        public string? Phone { get; set; }
        public string? Major { get; set; }
        public string Role { get; set; } = "student";
        public bool IsAvailable { get; set; }= true;
        public bool IsActive { get; set; } = true;
        public string Email { get; set; } = null!;
        public string? PasswordHash { get; set; }
        public ProfileDetails Profile { get; set; }

        public ICollection<StudentSkill> Skills { get; set; }= new List<StudentSkill>();
        public ICollection<ProjectMember> ProjectMembers { get; set; }= new List<ProjectMember>();
        public ICollection<TeamRequest> SentTeamRequests { get; set; }= new List<TeamRequest>();
        public ICollection<TeamRequest> ReceivedTeamRequests { get; set; }= new List<TeamRequest>();
        public ICollection<Notification> Notifications { get; set; }= new List<Notification>();

        



    }
}
