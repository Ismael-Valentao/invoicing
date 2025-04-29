const formatedDate = (date) =>{
    const date_tmp = new Date(date);
    const day = date_tmp.getDate();
    const month = date_tmp.getMonth() + 1;
    const year = date_tmp.getFullYear();
    const formattedDate = `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`;
    return formattedDate;
}

module.exports = {formatedDate};