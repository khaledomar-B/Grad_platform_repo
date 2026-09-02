using GradPlatformApi.Model.Projects;

namespace GradPlatformApi.Model.Users
{
    public class Supervisor
    {
        public int Id { get; set; }
        public string FirstName { get; set; } = null!;
        public string LastName { get; set; } = null!;
        public string College { get; set; } = null!;
        public string Email { get; set; } = null!;
        public string Department { get; set; } = null!;
        public string PasswordHash { get; set; } = null!;
        public string Role { get; set; } = "Supervisor";  // لتخزين الدور
        public bool IsActive { get; set; } = true;        // لتفعيل/تعطيل الحساب (اختياري)
        public bool IsApproved { get; set; } = false;     // لتحديد إذا كان الحساب تم الموافقة عليه من الأدمن
       

        public ICollection<Project> Projects { get; set; } = new List<Project>();
    }
}