namespace GradPlatformApi.Model.DTOs
{
    public class SetMilestoneDatesDto
    {
        public int SupervisorId { get; set; }  // المشرف الذي يحدد المواعيد
        public DateTime StartDate { get; set; } // تاريخ بداية التسليم
        public DateTime EndDate { get; set; }   // تاريخ نهاية التسليم
    }
}
