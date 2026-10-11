import {prisma} from "./db.js";
import {hashPassword} from "./security.js";
import {makeQrUrl} from "./qr.js";

async function main(){
  const existing=await prisma.restaurant.findUnique({where:{slug:"demo-olive-ember"}});
  if(existing){
    console.log("Seed already exists:",existing.id);
    return;
  }
  const restaurant=await prisma.restaurant.create({data:{
    name:"Olive & Ember",slug:"demo-olive-ember",address:"Hyderabad, Telangana",
    gstNumber:"36AAAAA0000A1Z5",taxRate:5
  }});
  const owner=await prisma.user.create({data:{
    restaurantId:restaurant.id,name:"Demo Owner",email:"owner@tableflow.demo",
    passwordHash:await hashPassword("ChangeMe123!"),role:"OWNER"
  }});
  await prisma.user.create({data:{
    restaurantId:restaurant.id,name:"Kitchen Lead",email:"kitchen@tableflow.demo",
    passwordHash:await hashPassword("ChangeMe123!"),role:"KITCHEN"
  }});

  const categories=await Promise.all(["Starters","Mains","Beverages","Desserts"].map((name,i)=>
    prisma.menuCategory.create({data:{restaurantId:restaurant.id,name,sortOrder:i}})
  ));
  const [starters,mains,bev,desserts]=categories;
  await prisma.menuItem.createMany({data:[
    {restaurantId:restaurant.id,categoryId:starters.id,name:"Smoked Paneer",price:Decimal("295"),station:"GRILL",basePrepTime:12},
    {restaurantId:restaurant.id,categoryId:starters.id,name:"Chicken Seekh",price:Decimal("340"),station:"TANDOOR",basePrepTime:15},
    {restaurantId:restaurant.id,categoryId:mains.id,name:"Butter Chicken",price:Decimal("420"),station:"GRAVY",basePrepTime:18},
    {restaurantId:restaurant.id,categoryId:mains.id,name:"Hyderabadi Biryani",price:Decimal("390"),station:"RICE",basePrepTime:16},
    {restaurantId:restaurant.id,categoryId:bev.id,name:"Mint Laban",price:Decimal("120"),station:"BEVERAGES",basePrepTime:5},
    {restaurantId:restaurant.id,categoryId:bev.id,name:"Saffron Cooler",price:Decimal("180"),station:"BEVERAGES",basePrepTime:5},
    {restaurantId:restaurant.id,categoryId:desserts.id,name:"Saffron Tres Leches",price:Decimal("260"),station:"DESSERT",basePrepTime:8}
  ]});
  const tables=await Promise.all(["T01","T02","T03","T04","T05","T06","T07","T08"].map(label=>
    prisma.restaurantTable.create({data:{restaurantId:restaurant.id,label,qrSecret:""}})
  ));
  console.log("\nTableFlow seeded.");
  console.log("Owner: owner@tableflow.demo / ChangeMe123!");
  console.log("Kitchen: kitchen@tableflow.demo / ChangeMe123!");
  console.log("\nQR URLs:");
  for(const t of tables) console.log(t.label,makeQrUrl(restaurant.id,t.id));
  await prisma.user.update({where:{id:owner.id},data:{name:"Olive & Ember Owner"}});
}
function Decimal(n:string){return n}
main().catch(e=>{console.error(e);process.exit(1)}).finally(()=>prisma.$disconnect());
