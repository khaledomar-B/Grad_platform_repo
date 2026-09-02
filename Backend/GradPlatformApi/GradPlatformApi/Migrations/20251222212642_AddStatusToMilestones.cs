using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GradPlatformApi.Migrations
{
    /// <inheritdoc />
    public partial class AddStatusToMilestones : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Status",
                table: "Milestones",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Status",
                table: "Milestones");
        }
    }
}
