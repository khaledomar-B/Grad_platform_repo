using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GradPlatformApi.Migrations
{
    /// <inheritdoc />
    public partial class addowner : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
    name: "OwnerStudentId",
    table: "Projects",
    nullable: true);    // ✅ بدون defaultValue


            migrationBuilder.CreateIndex(
                name: "IX_Projects_OwnerStudentId",
                table: "Projects",
                column: "OwnerStudentId");
            migrationBuilder.Sql(@"
UPDATE Projects
SET OwnerStudentId = NULL
WHERE OwnerStudentId IS NOT NULL
  AND OwnerStudentId NOT IN (SELECT Id FROM Students);
");


            migrationBuilder.AddForeignKey(
                name: "FK_Projects_Students_OwnerStudentId",
                table: "Projects",
                column: "OwnerStudentId",
                principalTable: "Students",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Projects_Students_OwnerStudentId",
                table: "Projects");

            migrationBuilder.DropIndex(
                name: "IX_Projects_OwnerStudentId",
                table: "Projects");

            migrationBuilder.DropColumn(
                name: "OwnerStudentId",
                table: "Projects");
        }
    }
}
